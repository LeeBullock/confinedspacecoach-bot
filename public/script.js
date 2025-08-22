const chat = document.getElementById("chat");
const q = document.getElementById("q");
const send = document.getElementById("send");

// Same-origin (served by your Render app). If you embed only the script on Wix, set your full URL here.
const API_BASE = ""; // e.g. "https://confinedspacecoachbot.onrender.com" when embedding elsewhere.

function add(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function spinner(node) {
  let i = 0;
  const frames = ["…thinking", "…thinking.", "…thinking..", "…thinking..."];
  const id = setInterval(() => { node.textContent = frames[i++ % frames.length]; }, 300);
  return () => clearInterval(id);
}

// Auto-resize textarea on input (better mobile UX)
function autoresize() {
  q.style.height = "auto";
  q.style.height = Math.min(q.scrollHeight, window.innerHeight * 0.4) + "px";
}
q.addEventListener("input", autoresize);

async function ask() {
  const question = (q.value || "").trim();
  if (!question) return;
  add("user", question);
  q.value = "";
  autoresize();

  const botNode = add("bot", "…thinking…");
  const stop = spinner(botNode);
  send.disabled = true;

  try {
    const endpoint = API_BASE ? `${API_BASE}/api/chat` : "/api/chat";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    stop();
    botNode.textContent = data?.answer || "Sorry, I couldn't generate an answer.";
  } catch (err) {
    console.error("Chat error:", err);
    stop();
    botNode.textContent = "Error talking to the bot.";
  } finally {
    send.disabled = false;
    q.focus();
  }
}

send.addEventListener("click", ask);
q.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask();
});

// initial height
autoresize();
