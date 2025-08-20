// qaForwarder.js (ESM)
// Express router that forwards Leads or Q&A to Make.
// It injects a body `secret` so we can filter in Make.

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

// CORS preflight (lets you call this from a web page if needed)
router.options('/coach/qa', (req, res) => {
  setCors(res);
  res.sendStatus(200);
});

router.post('/coach/qa', async (req, res) => {
  setCors(res);
  try {
    // Optional inbound lock: require x-secret when calling this endpoint
    if (FORWARD_SECRET && req.get('x-secret') !== FORWARD_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const isLead = body.name || body.email || body.company || body.reason 
|| body.notes;
    const isQA = typeof body.question === 'string' && typeof body.answer 
=== 'string';

    if (!isLead && !isQA) {
      return res.status(400).json({
        error: 'Invalid payload. Send lead fields or Q&A fields 
(question/answer).'
      });
    }

    // Add body secret for Make filter
    const payload = { ...body, secret: FORWARD_SECRET };

    const r = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    return res.status(200).json({ status: 'ok', make_status: r.status, 
make_body: text });
  } catch (e) {
    console.error('Forward error:', e);
    return res.status(500).json({ error: 'Forward failed' });
  }
});

export default router;

