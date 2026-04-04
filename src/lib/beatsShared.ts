import {
  LANES,
  STEP_COUNT,
  STEP_GRACE,
  STEP_HIT,
  STEP_OFF,
  type StepCell,
  emptyPattern,
} from "@/lib/drumMachine";

export type SavedBeat = {
  id: string;
  name: string;
  bpm: number;
  swing: number;
  pattern: StepCell[][];
};

export type BeatsDocument = {
  version: 1;
  beats: SavedBeat[];
  activeBeatId: string | null;
};

export function emptyBeatsDocument(): BeatsDocument {
  return { version: 1, beats: [], activeBeatId: null };
}

export function clonePattern(pattern: StepCell[][]): StepCell[][] {
  return pattern.map((row) => [...row]);
}

/** Copy steps 0..half-1 onto half..STEP_COUNT-1 (two identical 16-step phrases). */
export function duplicateFirstHalfPattern(pattern: StepCell[][]): StepCell[][] {
  const half = STEP_COUNT / 2;
  return pattern.map((row) => {
    const next = [...row];
    for (let i = 0; i < half; i++) {
      next[half + i] = next[i]!;
    }
    return next;
  });
}

export function patternsEqual(a: StepCell[][], b: StepCell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i];
    const rb = b[i];
    if (!ra || !rb || ra.length !== rb.length) return false;
    for (let j = 0; j < ra.length; j++) if (ra[j] !== rb[j]) return false;
  }
  return true;
}

function cellFromRaw(v: unknown): StepCell {
  if (v === STEP_GRACE || v === 2) return STEP_GRACE;
  if (v === true || v === STEP_HIT || v === 1) return STEP_HIT;
  return STEP_OFF;
}

export function normalizePattern(raw: unknown): StepCell[][] {
  const empty = emptyPattern();
  if (!Array.isArray(raw)) return empty;
  return LANES.map((_, ri) => {
    const row = raw[ri];
    if (!Array.isArray(row)) return [...empty[ri]];
    return Array.from({ length: STEP_COUNT }, (_, si) =>
      cellFromRaw(row[si]),
    );
  });
}

export function clampBpm(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 120;
  return Math.min(220, Math.max(40, Math.round(v)));
}

export function clampSwing(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(127, Math.max(0, Math.round(v)));
}
