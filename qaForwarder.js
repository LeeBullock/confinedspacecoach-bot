// qaForwarder.js (ESM) — forwards to Make and includes a body secret
import express from 'express';

const router = express.Router();
const { MAKE_WEBHOOK_URL, FORWARD_SECRET } = process.env;

function setCors(res) {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
}

router.options('/coach/qa', (req, res) => {
  setCors(res);
  res.sendStatus(200);
});

router.post('/coach/qa', async (req, res) => {
  setCors(res);
  try {
    if (FORWARD_SECRET && req.get('x-secret') !== FORWARD_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const isLead = body.name || body.email || body.company || body.reason || body.notes;
    const isQA = typeof body.question === 'string' && typeof body.answer === 'string';
    if (!isLead && !isQA) {
      return res.status(400).json({ error: 'Invalid payload: send lead fields or question/answer.' });
    }

    const payload = { ...body, secret: FORWARD_SECRET }; // Make will filter on this

    const r = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    return res.status(200).json({ status: 'ok', make_status: r.status, make_body: text });
  } catch (e) {
    console.error('Forward error:', e);
    return res.status(500).json({ error: 'Forward failed' });
  }
});

export default router;
