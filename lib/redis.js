const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Sends a single Redis command to Upstash's REST API.
// e.g. redis(['SET', 'key', 'value'])  or  redis(['SMEMBERS', 'my-set'])
async function redis(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error(
      'Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN environment variables.'
    );
  }

  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}

module.exports = { redis };
