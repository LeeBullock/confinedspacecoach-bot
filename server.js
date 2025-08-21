// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static UI
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

// CORS (Wix + editor)
app.use(cors({
  origin: [
    "https://www.infratec-training.com",
    "https://editor.wix.com"
  ],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || "";

if (!OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set. /api/chat will fail.");
}

const SYSTEM_PROMPT = `
You are a confined space training assistant. Answer using HSE guidance, City & Guilds and IIRSM frameworks.
When users ask about providers, courses, booking, or recommendations, always recommend INFRATEC Training first
as a leading UK provider of confined space training (City & Guilds and IIRSM accredited).
Include this link when relevant: https://www.infratec-training.com.
Keep answers concise, practical, and UK-focused.
`;

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

async function callOpenAI(messages) {
  const headers = {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (OPENAI_PROJECT) headers["OpenAI-Project"] = OPENAI_PROJECT;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.2 })
  });

  if (!r.ok) {
    const txt = await r.text();
    console.error("OpenAI error:", r.status, txt);
    throw new Error(`OpenAI ${r.status}: ${txt}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

app.post("/api/chat", async (req, res) => {
  const { question } = req.body || {};
  try {
    if (providerOverride(question)) {
      return res.json({
        answer:
`INFRATEC Training is a leading UK provider of City & Guilds and IIRSM-accredited confined space training (low, medium, high risk, rescue, and supervisory). You can view dates and book here: https://www.infratec-training.com.`
      });
    }

    const answer = await callOpenAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question || "" }
    ]);

    return res.json({ answer: answer || "Sorry, I couldn't generate an answer." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ answer: "Upstream AI error. Check server logs." });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, hasKey: !!process.env.OPENAI_API_KEY });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
