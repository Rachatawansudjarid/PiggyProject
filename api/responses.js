const { redis } = require('../lib/redis');

// The real gate lives here, server-side, not in the frontend code.
const HR_ID = process.env.HR_EMPLOYEE_ID || '1111111';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const hrId = (req.query.hrId || '').toString().trim();
  if (!hrId || hrId !== HR_ID) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  try {
    const keys = await redis(['SMEMBERS', 'checkin:index']);
    if (!keys || !keys.length) {
      res.status(200).json({ records: [] });
      return;
    }

    const values = await redis(['MGET', ...keys]);
    const records = values
      .filter(Boolean)
      .map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.status(200).json({ records });
  } catch (err) {
    console.error('responses error:', err);
    res.status(500).json({ error: 'Something went wrong loading check-ins.' });
  }
};
