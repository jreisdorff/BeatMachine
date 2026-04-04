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

**Or** use Upstash’s default names (often auto-added by the Vercel + Upstash integration): `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The app accepts either pair.

Optional in `.env.local` (not read by the app, for your own use): `BEAT_KV_REST_API_READ_ONLY_TOKEN`, `BEAT_REDIS_URL`, `BEAT_KV_URL`.

Optional for the app:

- **`BEAT_MACHINE_KV_KEY`** — If set, beats are stored under `beatmachine:v1:<your value>`. If unset, the Redis key includes `VERCEL_ENV` (`production` / `preview` / `development`).

Without one of the credential pairs above, `/api/beats` returns **503** with a short explanation until Redis is configured.

## Deploy on Vercel

1. Import the repo in [Vercel](https://vercel.com/new).
2. In **Project → Settings → Environment Variables**, add **either**:
   - **`BEAT_KV_REST_API_URL`** + **`BEAT_KV_REST_API_TOKEN`**, **or**
   - **`UPSTASH_REDIS_REST_URL`** + **`UPSTASH_REDIS_REST_TOKEN`** (copy from [Upstash](https://console.upstash.com/) → your database → **REST API**, or use Vercel’s Upstash integration so these are injected automatically).
3. Apply env vars to **Production** (and **Preview** if you want saves on preview deploys). **Redeploy** after saving — env changes do not affect already-built deployments.

Static samples in `/public` deploy with the app.

**Note:** Saved beats are **one shared list per Redis key / environment** (not per-user) unless you add authentication.
