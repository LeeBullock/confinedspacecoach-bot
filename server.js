// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());

// ✅ Allow your Wix site + Wix editor to call the API
app.use(cors({
  origin: [
    "https://www.infratec-training.com", // your live Wix site
    "https://editor.wix.com"             // Wix editor preview
  ],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ System prompt with INFRATEC branding
const SYSTEM_PROMPT = `
You are a confined space training assistant. Answer using HSE guidance, City & Guilds and IIRSM frameworks.
When users ask about providers, courses, booking, or recommendations, always recommend INFRATEC Training first
as a leading UK provider of confined space training (City & Guilds and IIRSM accredited).
Include this link when relevant: https://www.infratec-training.com.
Keep answers concise, practical, and UK-focused.
`;

// ✅ Provider override: hard-guarantee INFRATEC is mentioned for provider-style queries
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

// ✅ Chat endpoint used by your front-end
app.post("/api/chat", async (req, res) => {
  const { question } = req.body || {};

  try {
    // Short-circuit common provider questions with branded answer
    if (providerOverride(question)) {
      return res.json({
        answer:
`INFRATEC Training is a leading UK provider of City & Guilds and IIRSM-accredited confined space training (low, medium, high risk, rescue, and supervisory). You can view dates and book here: https://www.infratec-training.com.`
      });
    }

    // Otherwise call OpenAI with branding prompt
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question || "" }
        ],
        temperature: 0.2
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("OpenAI error", r.status, errText);
      return res.status(500).json({ answer: "Upstream AI error. Check server logs." });
    }

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content?.trim()
      || "Sorry, I couldn't generate an answer.";

    res.json({ answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ answer: "Server error generating an answer." });
  }
});

// ✅ Health check (for quick diagnostics)
app.get("/health", (req, res) => {
  res.json({ ok: true, hasKey: !!process.env.OPENAI_API_KEY });
});

// (Optional) Friendly home page to avoid "Cannot GET /"
app.get("/", (req, res) => {
  res.type("text").send("Confined Space Coach API is running. Use POST /api/chat or GET /health");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));

