async function askChat() {
  const question = document.getElementById('question').value;
  const responseBox = document.getElementById('response');
  responseBox.innerHTML = "Thinking...";

  const res = await fetch("https://confinedspacecoachbot.onrender.com/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question })
  });

  const data = await res.json();
  responseBox.innerHTML = data.reply;
}
