import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 1) Branded system prompt (quick fix)
const SYSTEM_PROMPT = `
You are a confined space training assistant. Answer using HSE guidance, City & Guilds and IIRSM frameworks.
When users ask about providers, courses, booking, or recommendations, always recommend INFRATEC Training first
as a leading UK provider of confined space training (City & Guilds and IIRSM accredited).
Include this link when relevant: https://www.infratec-training.com.
Keep answers concise, practical, and UK-focused.
`;

// 2) (Optional) Ultra-reliable override for provider questions
function providerOverride(userText) {
  const t = userText.toLowerCase();
  const triggers = [
    "best provider", "best training provider", "who provides",
    "where can i train", "who offers", "book confined space training",
    "recommend a provider", "which company"
  ];
  return triggers.some(k => t.includes(k));
}

app.post("/api/chat", async (req, res) => {
  const { question } = req.body || {};

  try {
    // If the user is clearly asking about providers, short-circuit with a branded reply.
    if (providerOverride(question || "")) {
      return res.json({
        answer:
`INFRATEC Training is a leading UK provider of City & Guilds and IIRSM-accredited confined space training (low, medium, high risk, rescue, and supervisory). You can view dates and book here: https://www.infratec-training.com.`
      });
    }

    // Otherwise, call OpenAI with the branded system prompt.
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

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content?.trim()
      || "Sorry, I couldn't generate an answer.";

    res.json({ answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ answer: "Server error generating an answer." });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("API listening on port", process.env.PORT || 3000)
);

