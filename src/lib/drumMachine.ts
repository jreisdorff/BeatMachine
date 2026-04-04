/** Total steps in the pattern (one bar of 32nd notes in 4/4). */
export const STEP_COUNT = 32;

/** First half only — grid shows this many columns below the `sm` breakpoint. */
export const STEP_COUNT_VISIBLE_COMPACT = 16;

/** Grid cell: off, full-velocity hit (left click), quiet grace note (right click). */
export type StepCell = 0 | 1 | 2;
export const STEP_OFF = 0 as const;
export const STEP_HIT = 1 as const;
export const STEP_GRACE = 2 as const;

/**
 * Four discrete grace gains vs full hits: very soft → almost full.
 * Index is controlled by the header slider.
 */
export const GRACE_VOLUME_STEPS = [0.08, 0.18, 0.34, 0.88] as const;

export type GraceVolumeStepIndex = 0 | 1 | 2 | 3;

export const GRACE_VOLUME_LABELS = [
  "Very soft",
  "Soft",
  "Medium",
  "Almost full",
] as const;

export function isStepActive(cell: StepCell): boolean {
  return cell === STEP_HIT || cell === STEP_GRACE;
}

/** One full pattern loop = one 4/4 bar at 32nd-note resolution. */
export const STEPS_PER_BAR = 32;

/** 32nd notes per quarter note (beat) — used for column guides and metronome quarters. */
export const STEPS_PER_QUARTER = 8;

export type LaneId =
  | "kick"
  | "snare"
  | "snareClap"
  | "hihat"
  | "crash"
  | "openHihat"
  | "hiTom"
  | "floorTom";

export const LANES: { id: LaneId; label: string }[] = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "snareClap", label: "Snare+Clap" },
  { id: "hihat", label: "Hi-hat" },
  { id: "crash", label: "Crash" },
  { id: "openHihat", label: "Open hi-hat" },
  { id: "hiTom", label: "Hi tom" },
  { id: "floorTom", label: "Floor tom" },
];

export function emptyPattern(): StepCell[][] {
  return LANES.map(() =>
    Array.from({ length: STEP_COUNT }, () => STEP_OFF),
  );
}

/** Duration of one 32nd note in ms at the given BPM. */
export function thirtySecondNoteMs(bpm: number): number {
  return (60 / bpm / 8) * 1000;
}

/** MPC-style range for swing amount (0 = straight). */
export const SWING_MAX = 127;

/**
 * Duration from the start of step `stepIndex` to the start of the next step.
 * Swing alternates every **16th-note pair** of 32nds (MPC-style off-beat delay), not every
 * single 32nd — otherwise swing fires at double rate and barely moves the groove.
 */
export function gapAfterStep(
  stepIndex: number,
  secondsPerStep: number,
  swing: number,
): number {
  const clamped = Math.min(SWING_MAX, Math.max(0, swing));
  const swingNorm = clamped / SWING_MAX;
  const delta = swingNorm * 0.5;
  const sixteenthPairIndex = Math.floor(stepIndex / 2);
  return (
    secondsPerStep *
    (1 + (sixteenthPairIndex % 2 === 0 ? delta : -delta))
  );
}

export function loopDurationSeconds(
  secondsPerStep: number,
  swing: number,
): number {
  let t = 0;
  for (let i = 0; i < STEP_COUNT; i++) {
    t += gapAfterStep(i, secondsPerStep, swing);
  }
  return t;
}

/** Which pattern step is active at `elapsed` seconds from the transport start (repeating each loop). */
export function stepAtElapsed(
  elapsed: number,
  secondsPerStep: number,
  swing: number,
): number {
  const loopLen = loopDurationSeconds(secondsPerStep, swing);
  if (loopLen <= 0) return 0;
  const e = ((elapsed % loopLen) + loopLen) % loopLen;
  let acc = 0;
  for (let s = 0; s < STEP_COUNT; s++) {
    const gap = gapAfterStep(s, secondsPerStep, swing);
    if (e < acc + gap) return s;
    acc += gap;
  }
  return STEP_COUNT - 1;
}
