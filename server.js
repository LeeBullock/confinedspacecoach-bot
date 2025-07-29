const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.post('/chat', (req, res) => {
  const userMessage = req.body.message;
  console.log("Received message:", userMessage);

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  // Replace this with actual logic later
  const reply = `You asked: "${userMessage}". Here's a placeholder answer.`;

  res.json({ reply });
});

// Serve index.html by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

