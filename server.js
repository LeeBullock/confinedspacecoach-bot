// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";
import qaForwarder from "./qaForwarder.js"; // keeps /coach/qa available if you need it

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("."));
app.use(qaForwarder); // mounts OPTIONS/POST /coach/qa (safe to keep)

// ---------- OpenAI ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Sheets logging (quiet unless configured) ----------
const SHEETS_URL = (process.env.SHEETS_WEBHOOK_URL || "").trim();

async function postToSheets(payload) {
  if (!SHEETS_URL) return { ok: true, skipped: true }; // silent if not set
  try {
    // Some Apps Script endpoints 302/303 to a final URL; preserve POST if they do
    const r1 = await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual"
    });
    if ([301, 302, 303, 307, 308].includes(r1.status)) {
      const loc = r1.headers.get("location");
      if (!loc) throw new Error("Redirect without Location header");
      const r2 = await fetch(loc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text2 = await r2.text();
      console.log("Sheets redirect POST:", r2.status, text2.slice(0, 200));
      return { ok: r2.ok, status: r2.status, body: text2 };
    }
    const text1 = await r1.text();
    console.log("Sheets direct POST:", r1.status, text1.slice(0, 200));
    return { ok: r1.ok, status: r1.status, body: text1 };
  } catch (e) {
    console.error("Sheets post error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

// ---------- Dormant Trello/Make forward (does nothing until env vars are set) ----------
async function postToMake(payload) {
  const url = (process.env.MAKE_WEBHOOK_URL || "").trim();
  const secret = (process.env.FORWARD_SECRET || "").trim();
  if (!url || !secret) return; // disabled until you add both env vars
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, secret }) // Make filter will use `secret`
    });
    const txt = await r.text();
    console.log("Make POST:", r.status, txt.slice(0, 200));
  } catch (e) {
    console.warn("Make forward skipped:", e?.message || e);
  }
}

// ---------- Helpers ----------
app.get("/_env", (_req, res) => {
  res.json({
    hasSheetsUrl: Boolean(SHEETS_URL),
    hasMakeUrl: Boolean((process.env.MAKE_WEBHOOK_URL || "").trim()),
    hasForwardSecret: Boolean((process.env.FORWARD_SECRET || "").trim()),
    nodeVersion: process.version
  });
});

app.get("/_logtest", async (_req, res) => {
  const result = await postToSheets({
    question: "health-check",
    answer: "ok",
    sessionId: "server-test",
    pagePath: "/_logtest"
  });
  res.json({ sent: true, result });
});

// ---------- Main chat endpoint ----------
app.post("/chat", async (req, res) => {
  const userMessage = (req.body?.message || "").toString().trim();
  if (!userMessage) return res.status(400).json({ error: "No message provided" });

  const t0 = Date.now();
  try {
    const systemPrompt =
      `You are "Confined Space Coach" for INFRATEC Training.
Provide concise, practical guidance aligned with UK HSE confined space principles.
You are not a substitute for a competent person. If a query requires on-site assessment
or emergency action, say so and point to company procedures and HSE guidance.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.2
    });

    const reply =
      completion.choices?.[0]?.message?.content ??
      "Sorry, I couldn’t generate a reply.";

    // Respond to the browser immediately
    res.json({ reply });

    // Fire-and-forget logging (won’t block the user)
    postToSheets({
      question: userMessage,
      answer: reply,
      sessionId: (req.body?.sessionId || req.ip || "").toString(),
      pagePath: (req.body?.pagePath || "").toString(),
      model: "gpt-4o-mini",
      latencyMs: Date.now() - t0,
      userAgent: (req.headers["user-agent"] || "").toString(),
      referrer: (req.headers["referer"] || req.headers["referrer"] || "").toString()
    });

    // Fire-and-forget Trello/Make (remains dormant until env vars are set)
    postToMake({
      question: userMessage,
      answer: reply,
      model: "gpt-4o-mini",
      sessionId: (req.body?.sessionId || req.ip || "").toString(),
      pageUrl:
        (req.body?.pageUrl ||
          req.headers["referer"] ||
          req.headers["referrer"] ||
          "").toString(),
      timestamp: new Date().toISOString(),
      source: "website-widget"
    });
  } catch (error) {
    console.error("OpenAI error:", error);
    // Friendly fallback (so the widget doesn’t look broken if the key hiccups)
    return res.status(200).json({
      reply:
        "I’m online but can’t reach the AI service right now. Please try again in a moment."
    });
  }
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
