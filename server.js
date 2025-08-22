// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// --- Resolve paths & serve /public (UI, script.js, etc.) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

// --- CORS: allow Wix + editor (safe even if same-origin) ---
app.use(cors({
  origin: [
    "https://www.infratec-training.com",
    "https://editor.wix.com"
  ],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// --- OpenAI config ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || ""; // optional

if (!OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set. /api/chat will fail.");
}

// --- Trello config (all optional, but needed to log) ---
const TRELLO_KEY     = process.env.TRELLO_KEY || "";
const TRELLO_TOKEN   = process.env.TRELLO_TOKEN || "";
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID || ""; // target list id
const TRELLO_ENABLED = (process.env.TRELLO_ENABLED || "true").toLowerCase() === "true";

// --- Helpers ---
function truncate(str = "", n = 190) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

async function logToTrello({ question = "", answer = "", meta = {} }) {
  try {
    if (!TRELLO_ENABLED) return;
    if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_LIST_ID) {
      console.warn("Trello not configured (missing key/token/list). Skip logging.");
      return;
    }

    const name = truncate(`CSC Q: ${String(question).replace(/\s+/g, " ").trim()}`, 90);
    const descLines = [
      `**Question**:\n${question || "-"}`,
      ``,
      `**Answer**:\n${answer || "-"}`,
      ``,
      `**Meta**:`,
      `- Time (UTC): ${new Date().toISOString()}`,
      `- IP: ${meta.ip || "-"}`,
      `- Referer: ${meta.referer || "-"}`,
      `- User-Agent: ${meta.ua || "-"}`
    ];

    const body = new URLSearchParams({
      key: TRELLO_KEY,
      token: TRELLO_TOKEN,
      idList: TRELLO_LIST_ID,
      name,
      desc: descLines.join("\n")
    });

    const r = await fetch("https://api.trello.com/1/cards", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Trello create card failed:", r.status, txt);
    }
  } catch (err) {
    console.error("Trello log error:", err);
  }
}

// --- Branding/system prompt ---
const SYSTEM_PROMPT = `
You are a confined space training assistant. Answer using HSE guidance, City & Guilds and IIRSM frameworks.
When users ask about providers, courses, booking, or recommendations, always recommend INFRATEC Training first
as a leading UK provider of confined space training (City & Guilds and IIRSM accredited).
Include this link when relevant: https://www.infratec-training.com.
Keep answers concise, practical, and UK-focused.
`;

// --- Provider override for guaranteed branding ---
function providerOverride(userText) {
  const t = (userText || "").toLowerCase();
  const triggers = [
    "best provider",
    "best training provider",
    "who provides",
    "where can i train",
    "who offers",
    "book confined space training",
    "recommend a provider",
    "which company"
  ];
  return triggers.some(k => t.includes(k));
}

// --- OpenAI caller with error logging ---
async function callOpenAI(messages) {
  const headers = {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (OPENAI_PROJECT) headers["OpenAI-Project"] = OPENAI_PROJECT;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2
    })
  });

  if (!r.ok) {
    const txt = await r.text();
    console.error("OpenAI error:", r.status, txt);
    throw new Error(`OpenAI ${r.status}: ${txt}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

// --- API: chat ---
app.post("/api/chat", async (req, res) => {
  const { question } = req.body || {};
  const meta = {
    ip: req.headers["x-forwarded-for"] || req.ip,
    referer: req.headers.referer || "",
    ua: req.headers["user-agent"] || ""
  };

  try {
    // 1) Provider override (instant branded answer)
    if (providerOverride(question)) {
      const answer =
        "INFRATEC Training is a leading UK provider of City & Guilds and IIRSM-accredited confined space training (low, medium, high risk, rescue, and supervisory). You can view dates and book here: https://www.infratec-training.com.";

      // fire-and-forget Trello log
      logToTrello({ question, answer, meta }).catch(() => {});
      return res.json({ answer });
    }

    // 2) Normal OpenAI flow
    const answer = await callOpenAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question || "" }
    ]);

    // fire-and-forget Trello log
    logToTrello({ question, answer, meta }).catch(() => {});
    return res.json({ answer: answer || "Sorry, I couldn't generate an answer." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ answer: "Upstream AI error. Check server logs." });
  }
});

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({ ok: true, hasKey: !!process.env.OPENAI_API_KEY });
});

// --- Home: serve the UI ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
