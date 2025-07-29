const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  console.log("Received message:", userMessage);

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    // Replace this context with your actual training info
    const systemPrompt = `
You are Confined Space Coach, a UK-based confined space training assistant. 
You answer questions based strictly on City & Guilds, IIRSM, and HSE guidance.
Be concise, accurate, and don't make up answers. If you don't know, say so.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Or "gpt-3.5-turbo"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.3
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: 'Something went wrong with AI.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

