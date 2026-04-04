/**
 * Remove duplicate beats per Redis document (first occurrence kept).
 * Duplicates match on normalized name, bpm, swing, and pattern grid.
 *
 * Runs against every key this app uses in the same Redis instance:
 *   beatmachine:v1:production | preview | development
 *   plus beatmachine:v1:<BEAT_MACHINE_KV_KEY> when set
 *
 * From repo root:
 *   node --env-file=.env.local scripts/dedupe-beats.mjs
 *   node --env-file=.env.local scripts/dedupe-beats.mjs --dry-run
 */
import { Redis } from "@upstash/redis";

const LANES = 8;
const STEP_COUNT = 32;

function resolveRestCredentials() {
  const url =
    process.env.BEAT_KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.BEAT_KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

function normalizePattern(raw) {
  const grid = Array.from({ length: LANES }, () =>
    Array.from({ length: STEP_COUNT }, () => 0),
  );
  if (!Array.isArray(raw)) return grid;
  for (let ri = 0; ri < LANES; ri++) {
    const row = raw[ri];
    if (!Array.isArray(row)) continue;
    for (let si = 0; si < STEP_COUNT; si++) {
      const v = row[si];
      grid[ri][si] =
        v === 2 ? 2 : v === 1 || v === true ? 1 : 0;
    }
  }
  return grid;
}

function clampBpm(n) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 120;
  return Math.min(220, Math.max(40, Math.round(v)));
}

function clampSwing(n) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(127, Math.max(0, Math.round(v)));
}

function fingerprint(beat) {
  return JSON.stringify({
    bpm: clampBpm(beat?.bpm),
    swing: clampSwing(beat?.swing),
    pattern: normalizePattern(beat?.pattern),
  });
}

function dedupeBeats(beats) {
  const seen = new Set();
  const kept = [];
  const removed = [];
  for (const b of beats) {
    if (!b || typeof b !== "object") continue;
    const fp = fingerprint(b);
    if (seen.has(fp)) {
      removed.push(b);
      continue;
    }
    seen.add(fp);
    kept.push(b);
  }
  return { kept, removed };
}

function resolveActiveAfterDedupe(originalBeats, kept, previousActiveId) {
  const keptIds = new Set(kept.map((b) => b.id));
  if (previousActiveId && keptIds.has(previousActiveId)) {
    return previousActiveId;
  }
  const prev = originalBeats.find((b) => b.id === previousActiveId);
  if (prev) {
    const fp = fingerprint(prev);
    const survivor = kept.find((b) => fingerprint(b) === fp);
    if (survivor) return survivor.id;
  }
  return kept[0]?.id ?? null;
}

function collectKeysToScan() {
  const keys = new Set([
    "beatmachine:v1:production",
    "beatmachine:v1:preview",
    "beatmachine:v1:development",
  ]);
  const custom = process.env.BEAT_MACHINE_KV_KEY?.trim();
  if (custom) keys.add(`beatmachine:v1:${custom}`);
  return keys;
}

async function resolveAllKeys(redis) {
  const keys = collectKeysToScan();
  try {
    const discovered = await redis.keys("beatmachine:v1:*");
    if (Array.isArray(discovered)) {
      for (const k of discovered) keys.add(k);
    }
  } catch (e) {
    console.warn(
      "Optional KEYS beatmachine:v1:* failed (using fixed key list):",
      e?.message ?? e,
    );
  }
  return [...keys].sort();
}

const creds = resolveRestCredentials();
if (!creds) {
  console.error(
    "Missing Redis REST credentials. Set BEAT_KV_REST_API_URL + BEAT_KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.",
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const redis = new Redis({ url: creds.url, token: creds.token });
const keysToScan = await resolveAllKeys(redis);

let totalRemoved = 0;

for (const key of keysToScan) {
  const raw = await redis.get(key);
  if (raw == null || typeof raw !== "object") {
    console.log(`[skip] ${key} — no document`);
    continue;
  }
  const beats = Array.isArray(raw.beats) ? raw.beats : [];
  if (beats.length === 0) {
    console.log(`[skip] ${key} — empty beats`);
    continue;
  }

  const { kept, removed } = dedupeBeats(beats);
  if (removed.length === 0) {
    console.log(`[ok]   ${key} — ${beats.length} beat(s), no duplicates`);
    continue;
  }

  const activeBeatId = resolveActiveAfterDedupe(
    beats,
    kept,
    typeof raw.activeBeatId === "string" ? raw.activeBeatId : null,
  );

  const doc = {
    version: 1,
    beats: kept,
    activeBeatId,
  };

  console.log(
    `\n[dedupe] ${key}\n  before: ${beats.length}  after: ${kept.length}  removed: ${removed.length}`,
  );
  for (const r of removed) {
    console.log(`    - ${JSON.stringify(r.name)} id=${r.id}`);
  }
  console.log(`  activeBeatId → ${activeBeatId}`);

  totalRemoved += removed.length;

  if (!dryRun) {
    await redis.set(key, doc);
    console.log(`  written.`);
  } else {
    console.log(`  (dry-run, not written)`);
  }
}

console.log(
  dryRun
    ? `\nDry run complete. ${totalRemoved} duplicate(s) would be removed. Run without --dry-run to apply.`
    : `\nDone. Removed ${totalRemoved} duplicate beat(s) total.`,
);
