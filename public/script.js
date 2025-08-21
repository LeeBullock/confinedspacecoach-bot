const chat = document.getElementById("chat");
const q = document.getElementById("q");
const send = document.getElementById("send");

function add(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function ask() {
  const question = (q.value || "").trim();
  if (!question) return;
  add("user", question);
  q.value = "";
  add("bot", "…thinking…");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    chat.lastChild.textContent = data.answer || "Sorry, no answer.";
  } catch (e) {
    chat.lastChild.textContent = "Error talking to the bot.";
  }
}

send.onclick = ask;
q.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask();
});
