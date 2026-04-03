/** Total steps in the pattern (two bars of 16th notes in 4/4). */
export const STEP_COUNT = 32;

/** 16th notes per 4/4 bar; used for bar lines and metronome downbeats. */
export const STEPS_PER_BAR = 16;

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

export function emptyPattern(): boolean[][] {
  return LANES.map(() => Array.from({ length: STEP_COUNT }, () => false));
}

export function sixteenthNoteMs(bpm: number): number {
  return (60 / bpm / 4) * 1000;
}

/** MPC-style range for swing amount (0 = straight). */
export const SWING_MAX = 127;

/**
 * Duration from the start of step `stepIndex` to the start of the next step.
 * Even steps (0,2,…) lengthen slightly; odd steps shorten, so each 8th-note pair still spans 2× a straight 16th.
 */
export function gapAfterStep(
  stepIndex: number,
  secondsPer16th: number,
  swing: number,
): number {
  const clamped = Math.min(SWING_MAX, Math.max(0, swing));
  const swingNorm = clamped / SWING_MAX;
  const delta = swingNorm * 0.5;
  return (
    secondsPer16th * (1 + (stepIndex % 2 === 0 ? delta : -delta))
  );
}

export function loopDurationSeconds(
  secondsPer16th: number,
  swing: number,
): number {
  let t = 0;
  for (let i = 0; i < STEP_COUNT; i++) {
    t += gapAfterStep(i, secondsPer16th, swing);
  }
  return t;
}

/** Which pattern step is active at `elapsed` seconds from the transport start (repeating each loop). */
export function stepAtElapsed(
  elapsed: number,
  secondsPer16th: number,
  swing: number,
): number {
  const loopLen = loopDurationSeconds(secondsPer16th, swing);
  if (loopLen <= 0) return 0;
  const e = ((elapsed % loopLen) + loopLen) % loopLen;
  let acc = 0;
  for (let s = 0; s < STEP_COUNT; s++) {
    const gap = gapAfterStep(s, secondsPer16th, swing);
    if (e < acc + gap) return s;
    acc += gap;
  }
  return STEP_COUNT - 1;
}
