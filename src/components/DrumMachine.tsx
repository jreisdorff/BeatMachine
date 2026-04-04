"use client";

import { DrumMachineHeader } from "@/components/drum-machine/DrumMachineHeader";
import { DrumMachineSavedBeats } from "@/components/drum-machine/DrumMachineSavedBeats";
import { DrumMachineStepGrid } from "@/components/drum-machine/DrumMachineStepGrid";
import { SaveBeatModal } from "@/components/drum-machine/SaveBeatModal";
import { useDrumMachineAudio } from "@/hooks/useDrumMachineAudio";
import { useDrumMachineBeats } from "@/hooks/useDrumMachineBeats";
import { useStepPaintFinish } from "@/hooks/useStepPaintFinish";
import {
  emptyPattern,
  STEP_HIT,
  STEP_OFF,
  type GraceVolumeStepIndex,
  type StepCell,
} from "@/lib/drumMachine";
import { useCallback, useState } from "react";

export function DrumMachine() {
  const [pattern, setPattern] = useState<StepCell[][]>(() => emptyPattern());
  const [bpm, setBpm] = useState(120);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [swing, setSwing] = useState(0);
  const [bpmEditing, setBpmEditing] = useState(false);
  const [bpmDraft, setBpmDraft] = useState("");
  const [graceVolumeStep, setGraceVolumeStep] =
    useState<GraceVolumeStepIndex>(1);
  const [masterVolume, setMasterVolume] = useState(85);

  const {
    isPlaying,
    currentStep,
    sampleNames,
    loadError,
    stopTransport,
    togglePlay,
    onSampleUpload,
  } = useDrumMachineAudio(
    pattern,
    bpm,
    swing,
    metronomeOn,
    graceVolumeStep,
    masterVolume,
  );

  const {
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
  } = useDrumMachineBeats(
    pattern,
    setPattern,
    bpm,
    setBpm,
    swing,
    setSwing,
    isPlaying,
    stopTransport,
  );

  const stepPaintRef = useStepPaintFinish(setPattern);

  const commitBpmFromDraft = useCallback(() => {
    const n = Number.parseInt(bpmDraft.trim(), 10);
    if (!Number.isFinite(n)) {
      return;
    }
    const clamped = Math.min(220, Math.max(40, n));
    setBpm(clamped);
  }, [bpmDraft]);

  const setStepHit = useCallback((laneIndex: number, step: number) => {
    setPattern((p) => {
      if (p[laneIndex][step] === STEP_HIT) return p;
      const next = p.map((row) => [...row]);
      next[laneIndex][step] = STEP_HIT;
      return next;
    });
  }, []);

  const setStepClear = useCallback((laneIndex: number, step: number) => {
    setPattern((p) => {
      if (p[laneIndex][step] === STEP_OFF) return p;
      const next = p.map((row) => [...row]);
      next[laneIndex][step] = STEP_OFF;
      return next;
    });
  }, []);

  const clearPattern = () => setPattern(emptyPattern());

  return (
    <div className="box-border flex h-full min-h-0 w-full flex-col px-1.5 py-1 sm:px-2 sm:py-1.5">
      <DrumMachineHeader
        swing={swing}
        setSwing={setSwing}
        bpm={bpm}
        bpmEditing={bpmEditing}
        setBpmEditing={setBpmEditing}
        bpmDraft={bpmDraft}
        setBpmDraft={setBpmDraft}
        commitBpmFromDraft={commitBpmFromDraft}
        metronomeOn={metronomeOn}
        setMetronomeOn={setMetronomeOn}
        isPlaying={isPlaying}
        onTogglePlay={() => void togglePlay()}
        onClearPattern={clearPattern}
        graceVolumeStep={graceVolumeStep}
        setGraceVolumeStep={setGraceVolumeStep}
        masterVolume={masterVolume}
        setMasterVolume={setMasterVolume}
      />

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

      <DrumMachineStepGrid
        pattern={pattern}
        setPattern={setPattern}
        setStepHit={setStepHit}
        setStepClear={setStepClear}
        stepPaintRef={stepPaintRef}
        currentStep={currentStep}
        isPlaying={isPlaying}
        sampleNames={sampleNames}
        onSampleUpload={onSampleUpload}
      />

      <DrumMachineSavedBeats
        savedBeats={savedBeats}
        activeBeatId={activeBeatId}
        onSelectBeat={selectSavedBeat}
        beatsBusy={beatsBusy}
        onOpenSaveModal={openSaveModal}
      />

      <SaveBeatModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        saveNameInput={saveNameInput}
        onSaveNameChange={setSaveNameInput}
        beatsBusy={beatsBusy}
        onSubmit={submitNewBeat}
      />

      <p className="mt-1 shrink-0 text-center text-[9px] leading-tight text-zinc-500 dark:text-zinc-500">
        <strong className="font-medium">Play</strong> unlocks audio
      </p>
    </div>
  );
}
