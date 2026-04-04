"use client";

import type { StepPaintSession } from "@/hooks/useStepPaintFinish";
import {
  LANES,
  STEPS_PER_QUARTER,
  STEP_COUNT,
  STEP_COUNT_VISIBLE_COMPACT,
  STEP_GRACE,
  STEP_HIT,
  STEP_OFF,
  isStepActive,
  type LaneId,
  type StepCell,
} from "@/lib/drumMachine";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";

function isQuarterBoundary(stepIndex: number) {
  return stepIndex > 0 && stepIndex % STEPS_PER_QUARTER === 0;
}

type DrumMachineStepGridProps = {
  pattern: StepCell[][];
  setPattern: Dispatch<SetStateAction<StepCell[][]>>;
  setStepHit: (laneIndex: number, step: number) => void;
  setStepClear: (laneIndex: number, step: number) => void;
  stepPaintRef: MutableRefObject<StepPaintSession | null>;
  currentStep: number;
  isPlaying: boolean;
  sampleNames: Record<LaneId, string | null>;
  onSampleUpload: (laneId: LaneId, file: File) => void;
  /** Below `sm` breakpoint: only first 16 step columns. */
  compactSteps: boolean;
};

function isPlayheadOnColumn(
  columnIndex: number,
  transportStep: number,
  compact: boolean,
): boolean {
  if (!compact) return transportStep === columnIndex;
  return (
    transportStep === columnIndex ||
    transportStep === columnIndex + STEP_COUNT_VISIBLE_COMPACT
  );
}

function cycleRightClick(cell: StepCell): StepCell {
  if (cell === STEP_GRACE) return STEP_OFF;
  return STEP_GRACE;
}

export function DrumMachineStepGrid({
  pattern,
  setPattern,
  setStepHit,
  setStepClear,
  stepPaintRef,
  currentStep,
  isPlaying,
  sampleNames,
  onSampleUpload,
  compactSteps,
}: DrumMachineStepGridProps) {
  const visibleSteps = compactSteps ? STEP_COUNT_VISIBLE_COMPACT : STEP_COUNT;

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
      <table className="w-full min-w-0 border-collapse text-[10px] leading-none">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-[5.5rem] min-w-[5.5rem] bg-zinc-100/95 px-1 py-0.5 text-left text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:w-24 sm:min-w-[6rem] dark:bg-zinc-900/95 dark:text-zinc-400">
              Sound
            </th>
            {Array.from({ length: visibleSteps }, (_, i) => (
              <th
                key={i}
                className={`px-0 py-0.5 text-center text-[8px] font-medium tabular-nums leading-tight sm:text-[9px] ${
                  isQuarterBoundary(i)
                    ? "border-l border-zinc-400 dark:border-zinc-500"
                    : ""
                } ${
                  isPlaying &&
                  isPlayheadOnColumn(i, currentStep, compactSteps)
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
              {Array.from({ length: visibleSteps }, (_, step) => {
                const cell = pattern[rowIndex][step];
                const isCurrent =
                  isPlaying &&
                  isPlayheadOnColumn(step, currentStep, compactSteps);
                const oddColumn = step % 2 === 1;
                const emptyBase = oddColumn
                  ? "border-zinc-200/90 bg-zinc-200/55 dark:border-zinc-600 dark:bg-zinc-800/90"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70";
                const stateLabel =
                  cell === STEP_HIT
                    ? "full hit"
                    : cell === STEP_GRACE
                      ? "grace note"
                      : "off";
                return (
                  <td
                    key={step}
                    className={`p-px text-center align-middle ${
                      isQuarterBoundary(step)
                        ? "border-l border-zinc-400 dark:border-zinc-500"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isStepActive(cell)}
                      aria-label={`${lane.label} step ${step + 1}, ${stateLabel}. Left click or drag to paint; drag from a hit or grace to erase. Right click grace.`}
                      onContextMenu={(e) => e.preventDefault()}
                      onPointerDown={(e) => {
                        if (e.button === 2) {
                          e.preventDefault();
                          setPattern((p) => {
                            const next = p.map((row) => [...row]);
                            next[rowIndex][step] = cycleRightClick(
                              next[rowIndex][step],
                            );
                            return next;
                          });
                          return;
                        }
                        if (e.button !== 0) return;
                        e.preventDefault();
                        stepPaintRef.current = {
                          active: true,
                          startLane: rowIndex,
                          startStep: step,
                          didDrag: false,
                          mode: isStepActive(cell) ? "erase" : "paint",
                        };
                      }}
                      onPointerEnter={() => {
                        const s = stepPaintRef.current;
                        if (!s?.active) return;
                        if (rowIndex === s.startLane && step === s.startStep)
                          return;
                        s.didDrag = true;
                        if (s.mode === "erase") {
                          setStepClear(s.startLane, s.startStep);
                          setStepClear(rowIndex, step);
                        } else {
                          setStepHit(s.startLane, s.startStep);
                          setStepHit(rowIndex, step);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== " " && e.key !== "Enter") return;
                        e.preventDefault();
                        setPattern((p) => {
                          const next = p.map((row) => [...row]);
                          const v = next[rowIndex][step];
                          if (v === STEP_HIT) next[rowIndex][step] = STEP_OFF;
                          else if (v === STEP_OFF)
                            next[rowIndex][step] = STEP_HIT;
                          else next[rowIndex][step] = STEP_OFF;
                          return next;
                        });
                      }}
                      className={`h-5 w-full min-w-[0.95rem] max-w-[1.15rem] touch-manipulation select-none rounded-sm border text-[8px] font-medium sm:min-w-[1.05rem] sm:max-w-[1.2rem] ${
                        cell === STEP_HIT
                          ? "border-rose-700 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-600"
                          : cell === STEP_GRACE
                            ? "border-emerald-700 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600"
                            : `${emptyBase} text-transparent hover:border-zinc-400 dark:hover:border-zinc-500`
                      } ${
                        isCurrent && !isStepActive(cell)
                          ? "ring-1 ring-emerald-500 ring-offset-0 dark:ring-emerald-400"
                          : ""
                      } ${
                        isCurrent && isStepActive(cell)
                          ? "ring-1 ring-amber-200 ring-offset-0 dark:ring-amber-400/80"
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
  );
}
