# Beat Machine

32-step browser drum sequencer (one 4/4 bar at 32nd-note resolution; Next.js). Saved beats use **[Upstash Redis](https://upstash.com/)** via `@upstash/redis` (REST).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment (`.env.local`)

Copy `.env.example` → `.env.local` and fill in values from the [Upstash console](https://console.upstash.com/) → your database → **REST API**:

| Variable | Purpose |
|----------|---------|
| `BEAT_KV_REST_API_URL` | REST endpoint (e.g. `https://xxx.upstash.io`) |
| `BEAT_KV_REST_API_TOKEN` | Primary token (read/write) |

Optional in `.env.local` (not read by the app, for your own use): `BEAT_KV_REST_API_READ_ONLY_TOKEN`, `BEAT_REDIS_URL`, `BEAT_KV_URL`.

Optional for the app:

- **`BEAT_MACHINE_KV_KEY`** — If set, beats are stored under `beatmachine:v1:<your value>`. If unset, the Redis key includes `VERCEL_ENV` (`production` / `preview` / `development`).

Without `BEAT_KV_REST_API_URL` and `BEAT_KV_REST_API_TOKEN`, the **Saved Beats** API returns an error until Redis is configured.

## Deploy on Vercel

1. Import the repo in [Vercel](https://vercel.com/new).
2. Add the same **`BEAT_KV_REST_API_URL`** and **`BEAT_KV_REST_API_TOKEN`** in **Project → Settings → Environment Variables** (from Upstash REST API).
3. Redeploy after saving env vars.

Static samples in `/public` deploy with the app.

**Note:** Saved beats are **one shared list per Redis key / environment** (not per-user) unless you add authentication.
