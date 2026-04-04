import { STEPS_PER_BAR, STEPS_PER_QUARTER } from "@/lib/drumMachine";

export const SCHEDULE_AHEAD_S = 0.14;
export const SCHEDULER_INTERVAL_MS = 25;

export function trackScheduledSource(
  node: AudioScheduledSourceNode,
  bucket: AudioScheduledSourceNode[],
) {
  bucket.push(node);
  node.addEventListener(
    "ended",
    () => {
      const i = bucket.indexOf(node);
      if (i !== -1) bucket.splice(i, 1);
    },
    { once: true },
  );
}

export function scheduleMetronomeClick(
  ctx: AudioContext,
  metronomeBus: AudioNode,
  step: number,
  atTime: number,
  track: AudioScheduledSourceNode[],
) {
  if (step % STEPS_PER_QUARTER !== 0) return;
  const downbeat = step % STEPS_PER_BAR === 0;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = downbeat ? 1900 : 1200;
  const peak = downbeat ? 0.08 : 0.05;
  g.gain.setValueAtTime(peak, atTime);
  g.gain.exponentialRampToValueAtTime(0.0008, atTime + 0.045);
  osc.connect(g);
  g.connect(metronomeBus);
  trackScheduledSource(osc, track);
  osc.start(atTime);
  osc.stop(atTime + 0.05);
}
