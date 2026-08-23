const { redis } = require('../lib/redis');

// Only these fields are ever stored, no matter what the client sends.
const PSS_IDS = ['pss1', 'pss2', 'pss3', 'pss4', 'pss5', 'pss6', 'pss7', 'pss8', 'pss9', 'pss10'];
const HSE_IDS = Array.from({ length: 35 }, (_, index) => `hse${index + 1}`);
const HSE_REVERSE = new Set([16, 25, 28, 33]);
const HSE_DIMENSIONS = {
  Demands: [3, 6, 9, 12, 16, 18, 20, 22],
  Control: [2, 10, 15, 19, 25, 30],
  "Managers' Support": [8, 23, 29, 35],
  'Peer Support': [4, 11, 27, 31],
  Relationships: [5, 14, 21, 28, 33],
  Role: [1, 7, 13, 17, 24],
  Change: [26, 32, 34]
};

function calculateHseScores(answers) {
  const scores = {};
  for (const [dimension, questionNumbers] of Object.entries(HSE_DIMENSIONS)) {
    const values = questionNumbers.map((number) => {
      const value = Number(answers[`hse${number}`]);
      return HSE_REVERSE.has(number) ? 6 - value : value;
    });
    scores[dimension] = values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return scores;
}

function hseRisk(score) {
  if (score >= 4) return 'Low Risk';
  if (score >= 3.5) return 'Moderate Risk';
  if (score >= 3) return 'High Risk';
  return 'Critical Risk';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { employeeId, department, answers, hseAnswers } = req.body || {};

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
    for (const id of PSS_IDS) {
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

    if (!hseAnswers || typeof hseAnswers !== 'object') {
      res.status(400).json({ error: 'hseAnswers is required' });
      return;
    }
    const cleanHseAnswers = {};
    for (const id of HSE_IDS) {
      const value = Number(hseAnswers[id]);
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        res.status(400).json({ error: `${id} must be a number from 1 to 5` });
        return;
      }
      cleanHseAnswers[id] = value;
    }
    const hseScores = calculateHseScores(cleanHseAnswers);
    const hseRiskLevels = Object.fromEntries(Object.entries(hseScores).map(([dimension, score]) => [dimension, hseRisk(score)]));

    const cleanId = employeeId.trim().slice(0, 64);
    const cleanDepartment = typeof department === 'string' ? department.trim().slice(0, 128) : '';
    const record = {
      employeeId: cleanId,
      department: cleanDepartment,
      submittedAt: new Date().toISOString(),
      answers: cleanAnswers,
      pssScore: totalScore,
      hseAnswers: cleanHseAnswers,
      hseScores,
      hseRiskLevels
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
