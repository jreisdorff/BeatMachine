# Beat Machine

32-step browser drum sequencer (Next.js). Patterns and BPM/swing are saved with **Vercel KV** (via `@vercel/kv`).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment (saved beats)

Create `.env.local` with credentials from your Vercel storage (Redis/KV / Upstash):

```bash
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
```

Without these, the app runs but the **Saved Beats** API returns an error until KV is configured.

Optional:

- **`BEAT_MACHINE_KV_KEY`** — If set, beats are stored under `beatmachine:v1:<your value>`. If unset, the key includes `VERCEL_ENV` (`production` / `preview` / `development`) so Production and Preview use separate data.

## Deploy on Vercel (quick)

1. Push this repo to GitHub and import the project in [Vercel](https://vercel.com/new).
2. In the Vercel project, open **Storage** → create or link a **Redis** database (Upstash). Vercel will inject `KV_REST_API_URL` and `KV_REST_API_TOKEN` into the project environment.
3. Redeploy if the env vars were added after the first deploy.

Static assets (default `.wav` samples) live in `/public` and deploy automatically.

**Note:** Saved beats are **one shared list per deployment environment** (not per-user). Anyone with your URL can see and change beats unless you add authentication later.
