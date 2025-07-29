app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  console.log("Received message:", userMessage);

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    console.log("Calling OpenAI with message:", userMessage); // 👈 Add this line

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
    res.json({ reply });

  } catch (error) {
    console.error("OpenAI error:", error); // 👈 This will help debug
    res.status(500).json({ error: 'Something went wrong with AI.' });
  }
});

