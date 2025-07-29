async function askChat() {
  const question = document.getElementById('question').value;
  const responseBox = document.getElementById('response');
  responseBox.innerHTML = "Thinking...";

  try {
    console.log("Sending message to server:", question);

    const res = await fetch("https://confinedspacecoachbot.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question })
    });

    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}`);
    }

    const data = await res.json();
    console.log("Server response:", data);

    responseBox.innerHTML = data.reply;

  } catch (error) {
    console.error("Fetch error:", error);
    responseBox.innerHTML = `❌ Error: ${error.message}`;
  }
}
