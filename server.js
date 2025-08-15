import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch"; // ensure fetch exists on Node

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(".")); // serves index.html, script.js

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Post to Apps Script and preserve POST on Google's redirect ---
async function postToSheets(payload) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) {
    console.warn("SHEETS_WEBHOOK_URL missing");
    return { ok: false, error: "no webhook url" };
  }
  try {
    const r1 = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual"
    });
    if ([301,302,303,307,308].includes(r1.status)) {
      const loc = r1.headers.get("location");
      if (!loc) throw new Error("Redirect without Location header");
      const r2 = await fetch(loc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text2 = await r2.text();
      console.log("Sheets redirect POST:", r2.status, text2.slice(0,200));
      return { ok: r2.ok, status: r2.status, body: text2 };
    }
    const text1 = await r1.text();
    console.log("Sheets direct POST:", r1.status, text1.slice(0,200));
    return { ok: r1.ok, status: r1.status, body: text1 };
  } catch (e) {
    console.error("Sheets post error:", e?.message || e);
    return { ok:false, error: e?.message || String(e) };
  }
}

// env check
app.get("/_env", (req, res) => {
  res.json({
    hasSheetsUrl: Boolean(process.env.SHEETS_WEBHOOK_URL),
    nodeVersion: process.version
  });
});

// direct test to Sheets
app.get("/_logtest", async (req, res) => {
  const result = await postToSheets({
    question: "health-check",
    answer: "ok",
    sessionId: "server-test",
    pagePath: "/_logtest"
  });
  res.json({ sent: true, result });
});

app.post("/chat", async (req, res) => {
  const userMessage = (req.body?.message || "").toString().trim();
  if (!userMessage) return res.status(400).json({ error: "No message provided" });

  const t0 = Date.now();
  try {
    const systemPrompt = `You are "Confined Space Coach" for INFRATEC Training.
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

    const reply = completion.choices?.[0]?.message?.content ?? "Sorry, I couldn’t generate a reply.";
    res.json({ reply });

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
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "Something went wrong with AI." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT} (sheetsWebhookSet=${Boolean(process.env.SHEETS_WEBHOOK_URL)})`)
);
