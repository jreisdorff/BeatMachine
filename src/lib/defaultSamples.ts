import type { LaneId } from "./drumMachine";

/**
 * Default one-shots served from /public (exact URL paths; case-sensitive on Linux).
 */
export const DEFAULT_SAMPLE_URL: Record<LaneId, string> = {
  kick: "/Kick.wav",
  snare: "/Snare.wav",
  snareClap: "/SnareClap.wav",
  hihat: "/HiHat.wav",
  crash: "/Crash.wav",
  openHihat: "/HiHatOpen.wav",
  hiTom: "/HiTom.wav",
  floorTom: "/FloorTom.wav",
};

function fileLabelFromPath(path: string): string {
  const base = path.replace(/^.*\//, "");
  return base || path;
}

export async function loadDefaultSamples(
  ctx: AudioContext,
): Promise<{ laneId: LaneId; buffer: AudioBuffer; label: string }[]> {
  const entries = Object.entries(DEFAULT_SAMPLE_URL) as [LaneId, string][];
  const results = await Promise.all(
    entries.map(async ([laneId, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        return { laneId, buffer, label: fileLabelFromPath(url) };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is NonNullable<typeof r> => r != null);
}
