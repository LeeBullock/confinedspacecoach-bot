const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// ✅ CORS fixed for Wix & public websites:
app.use(cors({
  origin: '*', // Allow any origin (you can restrict this later)
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

// ✅ Set up OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ POST /chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const userInput = req.body.message;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are Confined Space Coach, a confined space training expert using UK HSE guidance, City & Guilds, and IIRSM content.",
        },
        {
          role: "user",
          content: userInput
        }
      ]
    });

    res.json({ reply: completion.cho
