import {
  createBeatOnServer,
  fetchBeatsDoc,
  setActiveBeatOnServer,
  updateBeatOnServer,
} from "@/lib/beatsApiClient";
import { clonePattern, type SavedBeat } from "@/lib/beatsShared";
import type { StepCell } from "@/lib/drumMachine";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type PatternSetter = Dispatch<SetStateAction<StepCell[][]>>;

export function useDrumMachineBeats(
  pattern: StepCell[][],
  setPattern: PatternSetter,
  bpm: number,
  setBpm: (v: number) => void,
  swing: number,
  setSwing: (v: number) => void,
  isPlaying: boolean,
  stopTransport: () => void,
) {
  const [savedBeats, setSavedBeats] = useState<SavedBeat[]>([]);
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [beatsBusy, setBeatsBusy] = useState(false);
  const [beatsError, setBeatsError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [beatsHydrated, setBeatsHydrated] = useState(false);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullGenerationRef = useRef(0);
  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const swingRef = useRef(swing);
  const activeBeatIdRef = useRef(activeBeatId);
  patternRef.current = pattern;
  bpmRef.current = bpm;
  swingRef.current = swing;
  activeBeatIdRef.current = activeBeatId;

  const applyFullDoc = useCallback(
    (doc: { beats: SavedBeat[]; activeBeatId: string | null }) => {
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
    },
    [setPattern, setBpm, setSwing],
  );

  const pullBeatsFromCloud = useCallback(async () => {
    const gen = ++pullGenerationRef.current;
    setBeatsBusy(true);
    setBeatsError(null);
    try {
      let r = await fetchBeatsDoc();
      if (!r.ok && (r.status === 503 || r.status === 0)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (gen !== pullGenerationRef.current) return;
        r = await fetchBeatsDoc();
      }
      if (gen !== pullGenerationRef.current) return;

      if (!r.ok) {
        setBeatsError(r.error);
        setBeatsHydrated(true);
        return;
      }
      if (r.doc.beats.length > 0) {
        applyFullDoc(r.doc);
      } else {
        setSavedBeats([]);
        setActiveBeatId(null);
      }
      setBeatsHydrated(true);
    } finally {
      if (gen === pullGenerationRef.current) {
        setBeatsBusy(false);
      }
    }
  }, [applyFullDoc]);

  useEffect(() => {
    void pullBeatsFromCloud();
  }, [pullBeatsFromCloud]);

  useEffect(() => {
    if (!beatsHydrated || !activeBeatId) return;
    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = setTimeout(() => {
      cloudSaveTimerRef.current = null;
      void (async () => {
        const id = activeBeatIdRef.current;
        if (!id) return;
        const r = await updateBeatOnServer(id, {
          bpm: bpmRef.current,
          swing: swingRef.current,
          pattern: clonePattern(patternRef.current),
        });
        if (r.ok) setSavedBeats(r.doc.beats);
        else if (r.status !== 0) setBeatsError(r.error);
      })();
    }, 500);
    return () => {
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    };
  }, [beatsHydrated, pattern, bpm, swing, activeBeatId]);

  const selectSavedBeat = useCallback(
    async (id: string) => {
      if (!id) return;
      if (isPlaying) stopTransport();
      setBeatsError(null);
      const r = await setActiveBeatOnServer(id);
      if (!r.ok) {
        setBeatsError(r.error);
        return;
      }
      setSavedBeats(r.doc.beats);
      const beat = r.doc.beats.find((b) => b.id === id);
      if (!beat) {
        setActiveBeatId(r.doc.activeBeatId);
        return;
      }
      setActiveBeatId(beat.id);
      setPattern(clonePattern(beat.pattern));
      setBpm(beat.bpm);
      setSwing(beat.swing);
    },
    [isPlaying, stopTransport, setPattern, setBpm, setSwing],
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

  const openSaveModal = useCallback(() => {
    setBeatsError(null);
    setSaveNameInput("");
    setSaveModalOpen(true);
  }, []);

  return {
    savedBeats,
    activeBeatId,
    beatsBusy,
    beatsError,
    saveModalOpen,
    setSaveModalOpen,
    saveNameInput,
    setSaveNameInput,
    selectSavedBeat,
    submitNewBeat,
    openSaveModal,
  };
}
