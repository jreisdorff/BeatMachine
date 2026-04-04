import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Upstash Redis over HTTPS using REST credentials from `.env.local` (or Vercel):
 * - `BEAT_KV_REST_API_URL` — REST URL (e.g. https://xxx.upstash.io)
 * - `BEAT_KV_REST_API_TOKEN` — primary token (read/write)
 *
 * Optional `BEAT_KV_REST_API_READ_ONLY_TOKEN` is not used here; keep it for CLI/tools only.
 */
export function getBeatRedis(): Redis {
  if (client) return client;
  const url = process.env.BEAT_KV_REST_API_URL?.trim();
  const token = process.env.BEAT_KV_REST_API_TOKEN?.trim();
  if (!url || !token) {
    throw new Error(
      "Missing BEAT_KV_REST_API_URL or BEAT_KV_REST_API_TOKEN. Add them from the Upstash console (REST API).",
    );
  }
  client = new Redis({ url, token });
  return client;
}
