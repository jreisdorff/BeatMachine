/**
 * One-off: remove the first two beats from the shared Redis beats document.
 * Run from repo root:
 *   node --env-file=.env.local scripts/remove-first-two-beats.mjs
 */
import { Redis } from "@upstash/redis";

function kvDataKey() {
  const custom = process.env.BEAT_MACHINE_KV_KEY?.trim();
  if (custom) return `beatmachine:v1:${custom}`;
  const env = process.env.VERCEL_ENV ?? "development";
  return `beatmachine:v1:${env}`;
}

const url = process.env.BEAT_KV_REST_API_URL?.trim();
const token = process.env.BEAT_KV_REST_API_TOKEN?.trim();
if (!url || !token) {
  console.error(
    "Missing BEAT_KV_REST_API_URL or BEAT_KV_REST_API_TOKEN (e.g. from .env.local).",
  );
  process.exit(1);
}

const redis = new Redis({ url, token });
const key = kvDataKey();

const raw = await redis.get(key);
if (raw == null || typeof raw !== "object") {
  console.log("No beats document at key:", key);
  process.exit(0);
}

const beats = Array.isArray(raw.beats) ? raw.beats : [];
if (beats.length === 0) {
  console.log("No beats in document.");
  process.exit(0);
}

const removeCount = Math.min(2, beats.length);
const removed = beats.slice(0, removeCount);
const nextBeats = beats.slice(removeCount);

let activeBeatId =
  typeof raw.activeBeatId === "string" ? raw.activeBeatId : null;
if (removed.some((b) => b.id === activeBeatId)) {
  activeBeatId = nextBeats[0]?.id ?? null;
}
if (activeBeatId && !nextBeats.some((b) => b.id === activeBeatId)) {
  activeBeatId = nextBeats[0]?.id ?? null;
}

const doc = {
  version: 1,
  beats: nextBeats,
  activeBeatId,
};

await redis.set(key, doc);

console.log("Key:", key);
console.log(
  "Removed",
  removeCount,
  "beat(s):",
  removed.map((b) => b.name || b.id).join(", "),
);
console.log("Remaining:", nextBeats.length, "beat(s).");
console.log("activeBeatId:", activeBeatId);
