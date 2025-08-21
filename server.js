// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { logQAtoTrello } from "./trelloLogger.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---- serve frontend from /public ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// ---- OpenAI client ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---- Chat endpoint ----
app.post("/api/chat", async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing 'question' (string) in body" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
      temperature: 0.4,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn’t generate an answer.";

    // Fire-and-forget Trello log
    logQAtoTrello({
      question,
      answer,
      userAgent: req.get("user-agent"),
      sourceUrl: req.get("referer") || "https://confinedspacecoachbot.onrender.com",
      tags: ["Confined Space Coach", "Public Site"],
    }).catch(console.error);

    return res.json({ answer });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(500).json({ error: "Error generating response" });
  }
});

// ---- Health check (keep off "/") ----
app.get("/health", (_req, res) => res.send("✅ Confined Space Coach API is running."));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
