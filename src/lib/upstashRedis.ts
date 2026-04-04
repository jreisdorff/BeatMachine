import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Resolve REST URL + token. Supports this app's names and Upstash/Vercel defaults
 * (the Vercel Upstash integration usually sets UPSTASH_REDIS_REST_*).
 */
export function resolveUpstashRestCredentials(): {
  url: string;
  token: string;
} | null {
  const url =
    process.env.BEAT_KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.BEAT_KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

/**
 * Upstash Redis over HTTPS. Configure either:
 * - `BEAT_KV_REST_API_URL` + `BEAT_KV_REST_API_TOKEN`, or
 * - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (common on Vercel).
 */
export function getBeatRedis(): Redis {
  if (client) return client;
  const creds = resolveUpstashRestCredentials();
  if (!creds) {
    throw new Error(
      "Missing Redis REST credentials. Set BEAT_KV_REST_API_URL + BEAT_KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from the Upstash console.",
    );
  }
  client = new Redis({ url: creds.url, token: creds.token });
  return client;
}
