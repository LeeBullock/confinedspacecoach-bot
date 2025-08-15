app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  console.log("Received message:", userMessage);

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    console.log("Calling OpenAI with message:", userMessage);

    const systemPrompt = `You are Confined Space Coach...`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4", // or gpt-3.5-turbo
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.3
    });

    const reply = completion.choices[0].message.content;

    // ✅ Send to Google Sheets webhook
    if (process.env.SHEETS_WEBHOOK_URL) {
      fetch(process.env.SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          answer: reply,
          timestamp: new Date().toISOString()
        })
      })
      .then(() => console.log("Logged to Google Sheets"))
      .catch(err => console.error("Logging to Sheets failed:", err));
    } else {
      console.warn("⚠️ SHEETS_WEBHOOK_URL not set in environment");
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: 'Something went wrong with AI.' });
  }
});
