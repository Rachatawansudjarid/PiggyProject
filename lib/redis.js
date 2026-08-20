// Vercel's Storage integration names these KV_REST_API_URL / KV_REST_API_TOKEN.
// Falling back to UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN too, in case
// you set up Upstash directly instead of through Vercel's Storage tab.
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Sends a single Redis command to Upstash's REST API.
// e.g. redis(['SET', 'key', 'value'])  or  redis(['SMEMBERS', 'my-set'])
async function redis(command) {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error(
      'Missing KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) environment variables.'
    );
  }

  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
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