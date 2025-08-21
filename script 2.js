// script.js
const $q = document.getElementById('question');
const $out = document.getElementById('response');
const $btn = document.getElementById('askBtn');

function showTyping() {
  $out.innerHTML = '<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
}

function showText(txt) {
  $out.textContent = txt;
}

async function askChat() {
  const message = ($q.value || '').trim();
  if (!message) {
    showText('Please type a question.');
    return;
  }
  $btn.disabled = true;
  showTyping();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ message })
    });

    if (!res.ok) {
      const t = await res.text().catch(()=>'');
      throw new Error(`Server error ${res.status}: ${t.slice(0,200)}`);
    }

    const data = await res.json();
    const reply = (data && data.reply) ? String(data.reply) : 'Sorry, I could not generate a reply.';
    showText(reply);
  } catch (e) {
    console.error(e);
    showText('Sorry — the coach is online but could not answer just now. Please try again.');
  } finally {
    $btn.disabled = false;
  }
}

// Enter to send (with Shift+Enter for new line)
$q.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    askChat();
  }
});
