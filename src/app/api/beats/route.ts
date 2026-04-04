import { randomUUID } from "node:crypto";
import {
  clampBpm,
  clampSwing,
  emptyBeatsDocument,
  normalizePattern,
  type BeatsDocument,
  type SavedBeat,
} from "@/lib/beatsShared";
import { getBeatRedis } from "@/lib/upstashRedis";

export const runtime = "nodejs";

const MAX_NAME_LEN = 80;
const MAX_BEATS = 64;

/**
 * One document per deployment environment. Override with BEAT_MACHINE_KV_KEY
 * if you need a stable key across preview/production.
 */
function kvDataKey(): string {
  const custom = process.env.BEAT_MACHINE_KV_KEY?.trim();
  if (custom) return `beatmachine:v1:${custom}`;
  const env = process.env.VERCEL_ENV ?? "development";
  return `beatmachine:v1:${env}`;
}

function sanitizeDoc(raw: unknown): BeatsDocument {
  const base = emptyBeatsDocument();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<BeatsDocument>;
  if (o.version !== 1 || !Array.isArray(o.beats)) return base;
  const beats: SavedBeat[] = o.beats
    .slice(0, MAX_BEATS)
    .map((b) => ({
      id: typeof b?.id === "string" ? b.id : randomUUID(),
      name:
        typeof b?.name === "string"
          ? b.name.slice(0, MAX_NAME_LEN)
          : "Untitled",
      bpm: clampBpm(b?.bpm),
      swing: clampSwing(b?.swing),
      pattern: normalizePattern(b?.pattern),
    }));
  let activeBeatId: string | null =
    typeof o.activeBeatId === "string" ? o.activeBeatId : null;
  if (activeBeatId && !beats.some((b) => b.id === activeBeatId)) {
    activeBeatId = beats[0]?.id ?? null;
  }
  return { version: 1, beats, activeBeatId };
}

async function readDoc(key: string): Promise<BeatsDocument> {
  const redis = getBeatRedis();
  const raw = await redis.get<BeatsDocument>(key);
  return sanitizeDoc(raw);
}

async function writeDoc(key: string, doc: BeatsDocument): Promise<void> {
  const redis = getBeatRedis();
  await redis.set(key, doc);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    const key = kvDataKey();

    if (action === "list") {
      const doc = await readDoc(key);
      return Response.json({ doc });
    }

    if (action === "create") {
      const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
      const name = nameRaw.slice(0, MAX_NAME_LEN);
      if (!name) {
        return Response.json({ error: "Beat name is required." }, { status: 400 });
      }
      const doc = await readDoc(key);
      if (doc.beats.length >= MAX_BEATS) {
        return Response.json(
          { error: `Maximum ${MAX_BEATS} beats reached.` },
          { status: 400 },
        );
      }
      const beat: SavedBeat = {
        id: randomUUID(),
        name,
        bpm: clampBpm(body.bpm),
        swing: clampSwing(body.swing),
        pattern: normalizePattern(body.pattern),
      };
      doc.beats.push(beat);
      doc.activeBeatId = beat.id;
      await writeDoc(key, doc);
      return Response.json({ doc });
    }

    if (action === "update") {
      const beatId = typeof body.beatId === "string" ? body.beatId : "";
      if (!beatId) {
        return Response.json({ error: "beatId required" }, { status: 400 });
      }
      const doc = await readDoc(key);
      const idx = doc.beats.findIndex((b) => b.id === beatId);
      if (idx < 0) {
        return Response.json({ error: "Beat not found" }, { status: 404 });
      }
      doc.beats[idx] = {
        ...doc.beats[idx]!,
        bpm: clampBpm(body.bpm),
        swing: clampSwing(body.swing),
        pattern: normalizePattern(body.pattern),
      };
      await writeDoc(key, doc);
      return Response.json({ doc });
    }

    if (action === "setActive") {
      const beatId = typeof body.beatId === "string" ? body.beatId : "";
      if (!beatId) {
        return Response.json({ error: "beatId required" }, { status: 400 });
      }
      const doc = await readDoc(key);
      if (!doc.beats.some((b) => b.id === beatId)) {
        return Response.json({ error: "Beat not found" }, { status: 404 });
      }
      doc.activeBeatId = beatId;
      await writeDoc(key, doc);
      return Response.json({ doc });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[api/beats]", e);
    return Response.json(
      {
        error:
          "Could not reach the database. Fail....",
      },
      { status: 503 },
    );
  }
}
