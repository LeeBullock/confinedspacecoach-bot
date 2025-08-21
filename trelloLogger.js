// trelloLogger.js (ESM version)

const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID } = process.env;

const truncate = (str, n = 120) =>
  (str && str.length > n ? str.slice(0, n - 1) + "…" : str);

const scrubPII = (t = "") =>
  t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[redacted email]")
   .replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g, "[redacted phone]");

export async function logQAtoTrello({ question, answer, userAgent, sourceUrl, tags = [] }) {
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_LIST_ID) {
    console.warn("Trello env vars missing; skipping log.");
    return;
  }

  const cleanQ = scrubPII((question || "").trim());
  const cleanA = scrubPII((answer || "").trim());
  const name = truncate(`Q: ${cleanQ.replace(/\s+/g, " ")}`, 120);

  const desc = [
    `**Question**`,
    cleanQ || "—", ``,
    `**Answer**`,
    cleanA || "—", ``,
    `**Meta**`,
    `• Time (UTC): ${new Date().toISOString()}`,
    userAgent ? `• User-Agent: ${userAgent}` : null,
    sourceUrl ? `• Page: ${sourceUrl}` : null,
    tags.length ? `• Tags: ${tags.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const body = new URLSearchParams({
    idList: TRELLO_LIST_ID,
    key: TRELLO_KEY,
    token: TRELLO_TOKEN,
    name,
    desc,
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.trello.com/1/cards", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (res.status === 429 && attempt < 3) {
      const retry = Number(res.headers.get("retry-after") || 1);
      await new Promise(r => setTimeout(r, retry * 1000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Trello log failed (${res.status}): ${text}`);
    }
    break;
  }
}
