import { loadDefaultSamples } from "@/lib/defaultSamples";
import {
  GRACE_VOLUME_STEPS,
  LANES,
  STEP_COUNT,
  STEP_GRACE,
  STEP_HIT,
  gapAfterStep,
  stepAtElapsed,
  type GraceVolumeStepIndex,
  type LaneId,
  type StepCell,
} from "@/lib/drumMachine";
import {
  SCHEDULE_AHEAD_S,
  SCHEDULER_INTERVAL_MS,
  scheduleMetronomeClick,
  trackScheduledSource,
} from "@/lib/drumMachineAudio";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function useDrumMachineAudio(
  pattern: StepCell[][],
  bpm: number,
  swing: number,
  metronomeOn: boolean,
  graceVolumeStep: GraceVolumeStepIndex,
  /** 0–100 linear, applied to master output gain */
  masterVolume: number,
) {
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
  const secondsPerStepRef = useRef(60 / 120 / 8);
  const transportStartRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const schedulingStepRef = useRef(0);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiRafRef = useRef<number | null>(null);
  const activeSourcesRef = useRef<AudioScheduledSourceNode[]>([]);
  const swingRef = useRef(0);
  const graceGainRef = useRef(GRACE_VOLUME_STEPS[graceVolumeStep]);
  const masterLinearRef = useRef(
    Math.min(1, Math.max(0, masterVolume / 100)),
  );

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
    secondsPerStepRef.current = 60 / bpm / 8;
  }, [bpm]);

  useEffect(() => {
    swingRef.current = swing;
  }, [swing]);

  useEffect(() => {
    graceGainRef.current = GRACE_VOLUME_STEPS[graceVolumeStep];
  }, [graceVolumeStep]);

  useEffect(() => {
    const linear = Math.min(1, Math.max(0, masterVolume / 100));
    masterLinearRef.current = linear;
    const g = masterGainRef.current;
    if (g) g.gain.value = linear;
  }, [masterVolume]);

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === "closed") {
      audioContextRef.current = null;
      masterGainRef.current = null;
      metronomeGainRef.current = null;
      ctx = new AudioContext();
      audioContextRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = masterLinearRef.current;
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
      const ctx = audioContextRef.current;
      if (ctx) {
        void ctx.close();
        audioContextRef.current = null;
        masterGainRef.current = null;
        metronomeGainRef.current = null;
      }
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
        const cell = patternRef.current[i]?.[step];
        if (cell !== STEP_HIT && cell !== STEP_GRACE) return;
        const buf = buffersRef.current[lane.id];
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const stepGain = ctx.createGain();
        stepGain.gain.value =
          cell === STEP_GRACE ? graceGainRef.current : 1;
        src.connect(stepGain);
        stepGain.connect(master);
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
      const sp = secondsPerStepRef.current;
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
        const sp = secondsPerStepRef.current;
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

  const onSampleUpload = useCallback(
    async (laneId: LaneId, file: File) => {
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
    },
    [ensureAudio],
  );

  const togglePlay = useCallback(async () => {
    if (isPlayingRef.current) {
      stopTransport();
      return;
    }
    await ensureAudio();
    setCurrentStep(0);
    isPlayingRef.current = true;
    setIsPlaying(true);
  }, [ensureAudio, stopTransport]);

  return {
    isPlaying,
    currentStep,
    sampleNames,
    loadError,
    setLoadError,
    ensureAudio,
    stopTransport,
    togglePlay,
    onSampleUpload,
  };
}
