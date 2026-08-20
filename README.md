# Wellbeing Check-in

A simple internal tool: employees enter their ID and answer a short wellbeing
check-in; HR enters a special ID and sees every response on a dashboard.

- `index.html` \u2014 the whole frontend (static file, no build step)
- `api/submit.js` \u2014 serverless function that saves a check-in
- `api/responses.js` \u2014 serverless function that returns all check-ins, only if the ID matches `HR_EMPLOYEE_ID`
- `lib/redis.js` \u2014 tiny helper that talks to Upstash Redis over REST

Data is stored in **Upstash Redis**, which has a free tier and plugs straight
into Vercel with zero extra setup.

## 1. Create the database

**Easiest path \u2014 do it from inside Vercel:**
1. Push this folder to a GitHub repo and import it into Vercel (New Project \u2192 pick the repo).
2. In your new Vercel project, go to **Storage \u2192 Create Database \u2192 Upstash for Redis** (free tier).
3. Vercel automatically adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your project's environment variables. You don't need to copy/paste anything.

*(Alternative: sign up directly at [upstash.com](https://upstash.com), create a free Redis database, and copy the REST URL and token from its dashboard into Vercel's Environment Variables settings yourself.)*

## 2. Set the HR ID

In Vercel: **Project \u2192 Settings \u2192 Environment Variables**, add:

```
HR_EMPLOYEE_ID = <whatever ID you want to gate the dashboard>
```

If you skip this, it defaults to `1111111` \u2014 fine for testing, not for production.

## 3. Deploy

If you imported the repo in step 1, Vercel already deployed it \u2014 you're done.
Otherwise, from this folder:

```bash
npm i -g vercel
vercel
```

and follow the prompts (link/create a project, then it deploys).

## Running it locally

```bash
npm i -g vercel
vercel dev
```

This reads your `.env` file (copy `.env.example` to `.env` and fill in your
Upstash values first) and serves both `index.html` and the `/api` functions
on `http://localhost:3000`.

## How the data flows

- Submitting the form calls `POST /api/submit`, which writes the response to
  Redis under a key like `checkin:<employeeId>:<timestamp>` and adds that key
  to an index set (`checkin:index`) so it can be listed later.
- Entering an ID on the homepage calls `GET /api/responses?hrId=<id>`. The
  server checks that `id` against `HR_EMPLOYEE_ID`. If it matches, it returns
  every stored check-in and the page shows the dashboard. If it doesn't
  match, the page just starts the normal employee questionnaire \u2014 the
  frontend never hardcodes or checks the HR ID itself, so it can't be
  spoofed by reading the page source.

## Before using this with real people

- There's still no employee login \u2014 anyone who knows another employee's ID
  could, in theory, submit on their behalf. If that matters for your
  rollout, add real authentication (e.g. SSO) in front of this.
- Consider whether you need to log who *viewed* the HR dashboard, not just
  who can access it \u2014 useful for audit trails with sensitive data.
- Upstash's free tier has request limits; check their pricing page if you
  expect heavy usage.
