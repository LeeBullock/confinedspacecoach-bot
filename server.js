// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { logQAtoTrello } from "./trelloLogger.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Missing question" });
  }

  try {
    // Ask OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
    });

    const answer = completion.choices[0]?.message?.content || "";

    // Log to Trello (fire-and-forget)
    logQAtoTrello({
      question,
      answer,
      userAgent: req.get("user-agent"),
      sourceUrl: req.get("referer") || "https://confinedspacecoachbot.onrender.com",
      tags: ["Confined Space Coach", "Public Site"],
    }).catch(console.error);

    // Return answer to client
    res.json({ answer });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "Error generating response" });
  }
});

// Health check route (handy for Render)
app.get("/", (req, res) => {
  res.send("✅ Confined Space Coach API is running.");
});

// Use Render's assigned port, or 3000 locally
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
