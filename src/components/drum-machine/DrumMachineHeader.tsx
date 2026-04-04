"use client";

import {
  GRACE_VOLUME_LABELS,
  SWING_MAX,
  type GraceVolumeStepIndex,
} from "@/lib/drumMachine";

type DrumMachineHeaderProps = {
  swing: number;
  setSwing: (v: number) => void;
  bpm: number;
  bpmEditing: boolean;
  setBpmEditing: (v: boolean) => void;
  bpmDraft: string;
  setBpmDraft: (v: string) => void;
  commitBpmFromDraft: () => void;
  metronomeOn: boolean;
  setMetronomeOn: (v: boolean) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClearPattern: () => void;
  graceVolumeStep: GraceVolumeStepIndex;
  setGraceVolumeStep: (v: GraceVolumeStepIndex) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
};

export function DrumMachineHeader({
  swing,
  setSwing,
  bpm,
  bpmEditing,
  setBpmEditing,
  bpmDraft,
  setBpmDraft,
  commitBpmFromDraft,
  metronomeOn,
  setMetronomeOn,
  isPlaying,
  onTogglePlay,
  onClearPattern,
  graceVolumeStep,
  setGraceVolumeStep,
  masterVolume,
  setMasterVolume,
}: DrumMachineHeaderProps) {
  return (
    <header className="mb-1.5 flex shrink-0 flex-col items-center gap-1.5 text-center sm:mb-2">
      <div className="min-w-0 max-w-full">
        <h1 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
          Beat Machine
        </h1>
        <p className="text-[10px] leading-tight text-zinc-600 sm:text-xs dark:text-zinc-400">
          32 · 32nd notes (one bar) · upload one-shots
        </p>
      </div>
      <div className="grid w-full max-w-full grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1">
        <div className="min-w-0" aria-hidden />
        <div className="flex max-w-full flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <label className="flex w-32 shrink-0 flex-col gap-0.5 text-left text-[11px] text-zinc-700 dark:text-zinc-300">
          <span className="flex w-full items-center justify-between gap-1">
            <span>Grace Level</span>
            <span className="max-w-[4.5rem] truncate text-right text-[10px] text-zinc-500 dark:text-zinc-400">
              {GRACE_VOLUME_LABELS[graceVolumeStep]}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={graceVolumeStep}
            onChange={(e) =>
              setGraceVolumeStep(
                Math.min(
                  3,
                  Math.max(0, Number(e.target.value) || 0),
                ) as GraceVolumeStepIndex,
              )
            }
            className="h-1.5 w-full accent-zinc-500 dark:accent-zinc-400"
            aria-label="Grace note volume"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={graceVolumeStep}
            aria-valuetext={GRACE_VOLUME_LABELS[graceVolumeStep]}
          />
        </label>
        <label className="flex w-32 shrink-0 flex-col gap-0.5 text-left text-[11px] text-zinc-700 dark:text-zinc-300">
          <span className="flex w-full items-center justify-between gap-1">
            <span>Volume</span>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
              {masterVolume}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={masterVolume}
            onChange={(e) =>
              setMasterVolume(
                Math.min(100, Math.max(0, Number(e.target.value) || 0)),
              )
            }
            className="h-1.5 w-full accent-emerald-600"
            aria-label="Master output volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={masterVolume}
          />
        </label>
        <label className="flex w-36 shrink-0 flex-col gap-0.5 text-left text-[11px] text-zinc-700 dark:text-zinc-300">
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
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300">
          <span className="tabular-nums">BPM</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={bpmEditing ? bpmDraft : String(bpm)}
            onChange={(e) =>
              setBpmDraft(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
            onFocus={() => {
              setBpmEditing(true);
              setBpmDraft(String(bpm));
            }}
            onBlur={() => {
              commitBpmFromDraft();
              setBpmEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            aria-label="Tempo in BPM. Type a value and press Enter to apply."
            title="Click, type 40–220, press Enter (or blur) to set"
            className="w-[3.25rem] rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-center text-lg font-semibold tabular-nums text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label
          className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300"
          title="Clicks each beat; strongest click on bar start (step 1)."
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
          onClick={onTogglePlay}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
            isPlaying
              ? "bg-rose-600 text-white hover:bg-rose-500"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          {isPlaying ? "Stop" : "Play"}
        </button>
        </div>
        <div className="justify-self-end self-center">
          <button
            type="button"
            onClick={onClearPattern}
            className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Clear
          </button>
        </div>
      </div>
    </header>
  );
}
