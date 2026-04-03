"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createBeatOnServer,
  fetchBeatsDoc,
  setActiveBeatOnServer,
  updateBeatOnServer,
} from "@/lib/beatsApiClient";
import { clonePattern, type SavedBeat } from "@/lib/beatsShared";
import { loadDefaultSamples } from "@/lib/defaultSamples";
import {
  LANES,
  STEPS_PER_BAR,
  STEP_COUNT,
  SWING_MAX,
  emptyPattern,
  gapAfterStep,
  stepAtElapsed,
  type LaneId,
} from "@/lib/drumMachine";

const SCHEDULE_AHEAD_S = 0.14;
const SCHEDULER_INTERVAL_MS = 25;

function trackScheduledSource(node: AudioScheduledSourceNode, bucket: AudioScheduledSourceNode[]) {
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

function scheduleMetronomeClick(
  ctx: AudioContext,
  metronomeBus: AudioNode,
  step: number,
  atTime: number,
  track: AudioScheduledSourceNode[],
) {
  if (step % 4 !== 0) return;
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

export function DrumMachine() {
  const [pattern, setPattern] = useState<boolean[][]>(() => emptyPattern());
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sampleNames, setSampleNames] = useState<Record<LaneId, string | null>>(
    () =>
      Object.fromEntries(LANES.map((l) => [l.id, null])) as Record<
        LaneId,
        string | null
      >,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [swing, setSwing] = useState(0);
  const [savedBeats, setSavedBeats] = useState<SavedBeat[]>([]);
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [beatsBusy, setBeatsBusy] = useState(false);
  const [beatsError, setBeatsError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const metronomeGainRef = useRef<GainNode | null>(null);
  const buffersRef = useRef<Record<LaneId, AudioBuffer | null>>(
    Object.fromEntries(LANES.map((l) => [l.id, null])) as Record<
      LaneId,
      AudioBuffer | null
    >,
  );
  const patternRef = useRef(pattern);
  const metronomeOnRef = useRef(false);
  const isPlayingRef = useRef(false);
  const secondsPer16thRef = useRef(60 / 120 / 4);
  const transportStartRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const schedulingStepRef = useRef(0);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiRafRef = useRef<number | null>(null);
  const activeSourcesRef = useRef<AudioScheduledSourceNode[]>([]);
  const swingRef = useRef(0);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFullDoc = useCallback((doc: { beats: SavedBeat[]; activeBeatId: string | null }) => {
    setSavedBeats(doc.beats);
    if (doc.beats.length === 0) {
      setActiveBeatId(null);
      return;
    }
    const id =
      doc.activeBeatId && doc.beats.some((b) => b.id === doc.activeBeatId)
        ? doc.activeBeatId
        : doc.beats[0]!.id;
    setActiveBeatId(id);
    const b = doc.beats.find((x) => x.id === id)!;
    setPattern(clonePattern(b.pattern));
    setBpm(b.bpm);
    setSwing(b.swing);
  }, []);

  const pullBeatsFromCloud = useCallback(async () => {
    setBeatsBusy(true);
    setBeatsError(null);
    const r = await fetchBeatsDoc();
    setBeatsBusy(false);
    if (!r.ok) {
      setBeatsError(r.error);
      return;
    }
    if (r.doc.beats.length > 0) {
      applyFullDoc(r.doc);
    } else {
      setSavedBeats([]);
      setActiveBeatId(null);
    }
  }, [applyFullDoc]);

  useEffect(() => {
    void pullBeatsFromCloud();
  }, [pullBeatsFromCloud]);

  useEffect(() => {
    if (!activeBeatId) return;
    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = setTimeout(() => {
      cloudSaveTimerRef.current = null;
      void (async () => {
        const r = await updateBeatOnServer(activeBeatId, {
          bpm,
          swing,
          pattern: clonePattern(pattern),
        });
        if (r.ok) setSavedBeats(r.doc.beats);
        else if (r.status !== 0) setBeatsError(r.error);
      })();
    }, 500);
    return () => {
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    };
  }, [pattern, bpm, swing, activeBeatId]);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    metronomeOnRef.current = metronomeOn;
  }, [metronomeOn]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    secondsPer16thRef.current = 60 / bpm / 4;
  }, [bpm]);

  useEffect(() => {
    swingRef.current = swing;
  }, [swing]);

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      audioContextRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.85;
      gain.connect(ctx.destination);
      masterGainRef.current = gain;
      const metro = ctx.createGain();
      metro.gain.value = 0.35;
      metro.connect(gain);
      metronomeGainRef.current = metro;
    } else if (masterGainRef.current && !metronomeGainRef.current) {
      const metro = ctx.createGain();
      metro.gain.value = 0.35;
      metro.connect(masterGainRef.current);
      metronomeGainRef.current = metro;
    }
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ctx = await ensureAudio();
      if (!ctx || cancelled) return;
      try {
        const loaded = await loadDefaultSamples(ctx);
        if (cancelled) return;
        for (const { laneId, buffer } of loaded) {
          buffersRef.current[laneId] = buffer;
        }
        setSampleNames((prev) => {
          const next = { ...prev };
          for (const { laneId, label } of loaded) {
            next[laneId] = label;
          }
          return next;
        });
      } catch {
        if (!cancelled) {
          setLoadError("Could not load default samples from /public.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureAudio]);

  const stopAllScheduledSources = useCallback(() => {
    for (const node of activeSourcesRef.current) {
      try {
        node.stop(0);
      } catch {
        /* already stopped or cannot stop */
      }
    }
    activeSourcesRef.current = [];
  }, []);

  const stopTransport = useCallback(() => {
    isPlayingRef.current = false;
    if (schedulerTimerRef.current != null) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    if (uiRafRef.current != null) {
      cancelAnimationFrame(uiRafRef.current);
      uiRafRef.current = null;
    }
    stopAllScheduledSources();
    setIsPlaying(false);
    setCurrentStep(0);
  }, [stopAllScheduledSources]);

  useEffect(() => {
    return () => {
      if (schedulerTimerRef.current != null) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      if (uiRafRef.current != null) {
        cancelAnimationFrame(uiRafRef.current);
        uiRafRef.current = null;
      }
      for (const node of activeSourcesRef.current) {
        try {
          node.stop(0);
        } catch {
          /* ignore */
        }
      }
      activeSourcesRef.current = [];
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let cancelled = false;

    const scheduleStepAtTime = (step: number, atTime: number) => {
      const ctx = audioContextRef.current;
      const master = masterGainRef.current;
      if (!ctx || !master) return;

      const track = activeSourcesRef.current;

      LANES.forEach((lane, i) => {
        if (!patternRef.current[i]?.[step]) return;
        const buf = buffersRef.current[lane.id];
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(master);
        trackScheduledSource(src, track);
        src.start(atTime);
      });

      const metroBus = metronomeGainRef.current;
      if (metronomeOnRef.current && metroBus) {
        scheduleMetronomeClick(ctx, metroBus, step, atTime, track);
      }
    };

    const runSchedulerTick = () => {
      const ctx = audioContextRef.current;
      if (!ctx || !isPlayingRef.current || cancelled) return;
      const sp = secondsPer16thRef.current;
      const sw = swingRef.current;
      while (nextStepTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
        const s = schedulingStepRef.current;
        scheduleStepAtTime(s, nextStepTimeRef.current);
        nextStepTimeRef.current += gapAfterStep(s, sp, sw);
        schedulingStepRef.current = (s + 1) % STEP_COUNT;
      }
    };

    const uiLoop = () => {
      if (cancelled || !isPlayingRef.current) return;
      const ctx = audioContextRef.current;
      if (ctx) {
        const sp = secondsPer16thRef.current;
        const elapsed = ctx.currentTime - transportStartRef.current;
        const step = stepAtElapsed(
          Math.max(0, elapsed),
          sp,
          swingRef.current,
        );
        setCurrentStep(step);
      }
      uiRafRef.current = requestAnimationFrame(uiLoop);
    };

    void (async () => {
      const ctx = await ensureAudio();
      if (cancelled || !ctx) return;

      const sp = secondsPer16thRef.current;
      const start = ctx.currentTime + 0.06;
      transportStartRef.current = start;
      nextStepTimeRef.current = start;
      schedulingStepRef.current = 0;

      runSchedulerTick();
      schedulerTimerRef.current = setInterval(
        runSchedulerTick,
        SCHEDULER_INTERVAL_MS,
      );
      uiRafRef.current = requestAnimationFrame(uiLoop);
    })();

    return () => {
      cancelled = true;
      if (schedulerTimerRef.current != null) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      if (uiRafRef.current != null) {
        cancelAnimationFrame(uiRafRef.current);
        uiRafRef.current = null;
      }
      stopAllScheduledSources();
    };
  }, [isPlaying, ensureAudio, stopAllScheduledSources]);

  const toggleStep = (laneIndex: number, step: number) => {
    setPattern((p) => {
      const next = p.map((row) => [...row]);
      next[laneIndex][step] = !next[laneIndex][step];
      return next;
    });
  };

  const clearPattern = () => setPattern(emptyPattern());

  const selectSavedBeat = useCallback(
    (id: string) => {
      if (!id || !savedBeats.some((b) => b.id === id)) return;
      if (isPlaying) stopTransport();
      const beat = savedBeats.find((b) => b.id === id);
      if (!beat) return;
      setActiveBeatId(beat.id);
      setPattern(clonePattern(beat.pattern));
      setBpm(beat.bpm);
      setSwing(beat.swing);
      void (async () => {
        const r = await setActiveBeatOnServer(id);
        if (r.ok) setSavedBeats(r.doc.beats);
        else setBeatsError(r.error);
      })();
    },
    [savedBeats, isPlaying, stopTransport],
  );

  const submitNewBeat = useCallback(async () => {
    const name = saveNameInput.trim().slice(0, 80);
    if (!name) {
      setBeatsError("Enter a name for your beat.");
      return;
    }
    setBeatsError(null);
    setBeatsBusy(true);
    const r = await createBeatOnServer({
      name,
      bpm,
      swing,
      pattern: clonePattern(pattern),
    });
    setBeatsBusy(false);
    if (!r.ok) {
      setBeatsError(r.error);
      return;
    }
    applyFullDoc(r.doc);
    setSaveModalOpen(false);
    setSaveNameInput("");
  }, [saveNameInput, bpm, swing, pattern, applyFullDoc]);

  const onSampleUpload = async (laneId: LaneId, file: File) => {
    setLoadError(null);
    try {
      const ctx = await ensureAudio();
      if (!ctx) return;
      const ab = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      buffersRef.current[laneId] = buffer;
      setSampleNames((n) => ({ ...n, [laneId]: file.name }));
    } catch {
      setLoadError(`Could not decode "${file.name}". Try WAV or MP3.`);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      stopTransport();
      return;
    }
    await ensureAudio();
    setCurrentStep(0);
    setIsPlaying(true);
  };

  return (
    <div className="box-border flex h-full min-h-0 w-full flex-col px-1.5 py-1 sm:px-2 sm:py-1.5">
      <header className="mb-1.5 flex shrink-0 flex-col gap-1.5 sm:mb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 shrink">
          <h1 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
            Beat Machine
          </h1>
          <p className="text-[10px] leading-tight text-zinc-600 sm:text-xs dark:text-zinc-400">
            32 steps (two bars of 16ths) · upload one-shots
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
            <label className="flex w-[min(100%,11rem)] min-w-[8rem] flex-col gap-0.5 text-[11px] text-zinc-700 dark:text-zinc-300">
              <span className="flex w-full items-center justify-between gap-1">
                <span>Swing</span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {swing}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={SWING_MAX}
                value={swing}
                onChange={(e) =>
                  setSwing(
                    Math.min(
                      SWING_MAX,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  )
                }
                className="h-1.5 w-full accent-emerald-600"
                aria-label="Swing amount"
                aria-valuemin={0}
                aria-valuemax={SWING_MAX}
                aria-valuenow={swing}
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300">
              <span className="tabular-nums">BPM</span>
              <input
                type="number"
                min={40}
                max={220}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value) || 120)}
                className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-900 tabular-nums dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label
              className="flex cursor-pointer items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300"
              title="Clicks every quarter note; strong click each new bar (steps 1 & 17)."
            >
              <input
                type="checkbox"
                checked={metronomeOn}
                onChange={(e) => setMetronomeOn(e.target.checked)}
                className="size-3 rounded border-zinc-300 text-emerald-600 dark:border-zinc-600"
              />
              Metro
            </label>
            <button
              type="button"
              onClick={togglePlay}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                isPlaying
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {isPlaying ? "Stop" : "Play"}
            </button>
            <button
              type="button"
              onClick={clearPattern}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {loadError && (
        <p
          className="mb-1 shrink-0 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {loadError}
        </p>
      )}

      {beatsError && (
        <p
          className="mb-1 shrink-0 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
          role="alert"
        >
          {beatsError}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
        <table className="w-full min-w-0 border-collapse text-[10px] leading-none">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[5.5rem] min-w-[5.5rem] bg-zinc-100/95 px-1 py-0.5 text-left text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:w-24 sm:min-w-[6rem] dark:bg-zinc-900/95 dark:text-zinc-400">
                Sound
              </th>
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <th
                  key={i}
                  className={`px-0 py-0.5 text-center text-[8px] font-medium tabular-nums leading-tight sm:text-[9px] ${
                    i === STEPS_PER_BAR
                      ? "border-l border-zinc-400 dark:border-zinc-500"
                      : ""
                  } ${
                    isPlaying && currentStep === i
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500 dark:text-zinc-500"
                  }`}
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LANES.map((lane, rowIndex) => (
              <tr
                key={lane.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="sticky left-0 z-10 bg-zinc-50 px-1 py-0.5 align-middle dark:bg-zinc-950">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-[10px] font-medium leading-tight text-zinc-900 sm:text-[11px] dark:text-zinc-100">
                        {lane.label}
                      </span>
                      <label className="cursor-pointer shrink-0">
                        <span className="inline-flex rounded bg-zinc-200 px-1 py-px text-[8px] font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                          Up
                        </span>
                        <input
                          type="file"
                          accept="audio/*,.wav,.mp3,.ogg,.webm,.aac,.m4a,.flac"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onSampleUpload(lane.id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {sampleNames[lane.id] && (
                      <span
                        className="max-w-[4.5rem] truncate text-[8px] text-zinc-500 dark:text-zinc-400"
                        title={sampleNames[lane.id]!}
                      >
                        {sampleNames[lane.id]}
                      </span>
                    )}
                  </div>
                </td>
                {Array.from({ length: STEP_COUNT }, (_, step) => {
                  const on = pattern[rowIndex][step];
                  const isCurrent = isPlaying && currentStep === step;
                  return (
                    <td
                      key={step}
                      className={`p-px text-center align-middle ${
                        step === STEPS_PER_BAR
                          ? "border-l border-zinc-400 dark:border-zinc-500"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`${lane.label} step ${step + 1}`}
                        onClick={() => toggleStep(rowIndex, step)}
                        className={`h-5 w-full min-w-[0.95rem] max-w-[1.15rem] rounded-sm border text-[8px] font-medium sm:min-w-[1.05rem] sm:max-w-[1.2rem] ${
                          on
                            ? "border-emerald-600 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-600"
                            : "border-zinc-200 bg-white text-transparent hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                        } ${
                          isCurrent && !on
                            ? "ring-1 ring-emerald-500 ring-offset-0 dark:ring-emerald-400"
                            : ""
                        } ${
                          isCurrent && on
                            ? "ring-1 ring-emerald-300 dark:ring-emerald-300"
                            : ""
                        }`}
                      >
                        ·
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-1.5 flex shrink-0 flex-col gap-1 border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[10px] text-zinc-700 dark:text-zinc-300">
            <span className="shrink-0 font-medium">Saved Beats</span>
            <select
              value={activeBeatId ?? ""}
              disabled={savedBeats.length === 0}
              onChange={(e) => selectSavedBeat(e.target.value)}
              className="min-w-0 max-w-44 flex-1 rounded border border-zinc-300 bg-white px-1 py-px text-[10px] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              aria-label="Choose a saved beat"
            >
              {savedBeats.length === 0 ? (
                <option value="">— No beats yet —</option>
              ) : (
                savedBeats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setBeatsError(null);
              setSaveNameInput("");
              setSaveModalOpen(true);
            }}
            disabled={beatsBusy}
            className="rounded border border-emerald-600 bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Save Beat
          </button>
        </div>
        <p className="text-[8px] leading-tight text-zinc-500 dark:text-zinc-500">
          Beats are stored in Vercel KV for this deployment (shared by all visitors).
        </p>
      </div>

      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSaveModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-labelledby="save-beat-title"
            className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="save-beat-title"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Save beat
            </h2>
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              Name this pattern. It is added to the shared Saved Beats list for
              this site.
            </p>
            <input
              type="text"
              value={saveNameInput}
              onChange={(e) => setSaveNameInput(e.target.value)}
              placeholder="e.g. Dilla swing"
              maxLength={80}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setSaveModalOpen(false);
                if (e.key === "Enter") void submitNewBeat();
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitNewBeat()}
                disabled={beatsBusy}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-1 shrink-0 text-center text-[9px] leading-tight text-zinc-500 dark:text-zinc-500">
        <strong className="font-medium">Play</strong> unlocks audio · bar 2 starts
        at step 17
      </p>
    </div>
  );
}
