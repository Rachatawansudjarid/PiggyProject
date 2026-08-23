const { redis } = require('../lib/redis');

// Only these fields are ever stored, no matter what the client sends.
const QUESTION_IDS = ['pss1', 'pss2', 'pss3', 'pss4', 'pss5', 'pss6', 'pss7', 'pss8', 'pss9', 'pss10'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { employeeId, answers } = req.body || {};

    if (!employeeId || typeof employeeId !== 'string' || !employeeId.trim()) {
      res.status(400).json({ error: 'employeeId is required' });
      return;
    }
    if (!answers || typeof answers !== 'object') {
      res.status(400).json({ error: 'answers is required' });
      return;
    }

    const reverseKeys = new Set(['pss4', 'pss5', 'pss7', 'pss8']);
    const cleanAnswers = {};
    let totalScore = 0;
    for (const id of QUESTION_IDS) {
      const raw = answers[id];
      if (raw !== undefined && raw !== null && raw !== '') {
        const value = Number(raw);
        if (Number.isFinite(value)) {
          const normalized = reverseKeys.has(id) ? (4 - value) : value;
          cleanAnswers[id] = value;
          totalScore += normalized;
        }
      }
    }

    const cleanId = employeeId.trim().slice(0, 64);
    const record = {
      employeeId: cleanId,
      submittedAt: new Date().toISOString(),
      answers: cleanAnswers,
      pssScore: totalScore
    };

    // A colon-delimited key with a timestamp keeps a full history per employee.
    const safeId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const key = `checkin:${safeId}:${Date.now()}`;

    await redis(['SET', key, JSON.stringify(record)]);
    // Keep an index set so we can list every check-in later without a slow SCAN.
    await redis(['SADD', 'checkin:index', key]);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('submit error:', err);
    res.status(500).json({ error: 'Something went wrong saving your check-in.' });
  }
};
