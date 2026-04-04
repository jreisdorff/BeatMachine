import {
  STEP_HIT,
  STEP_OFF,
  type StepCell,
} from "@/lib/drumMachine";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";

export type StepPaintSession = {
  active: boolean;
  startLane: number;
  startStep: number;
  didDrag: boolean;
};

export function useStepPaintFinish(
  setPattern: Dispatch<SetStateAction<StepCell[][]>>,
): MutableRefObject<StepPaintSession | null> {
  const stepPaintRef = useRef<StepPaintSession | null>(null);

  useEffect(() => {
    const finishStepPaint = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const s = stepPaintRef.current;
      if (!s?.active) return;
      stepPaintRef.current = null;
      if (!s.didDrag) {
        setPattern((p) => {
          const next = p.map((row) => [...row]);
          const v = next[s.startLane][s.startStep];
          if (v === STEP_HIT) next[s.startLane][s.startStep] = STEP_OFF;
          else if (v === STEP_OFF) next[s.startLane][s.startStep] = STEP_HIT;
          else next[s.startLane][s.startStep] = STEP_OFF;
          return next;
        });
      }
    };
    window.addEventListener("pointerup", finishStepPaint);
    window.addEventListener("pointercancel", finishStepPaint);
    return () => {
      window.removeEventListener("pointerup", finishStepPaint);
      window.removeEventListener("pointercancel", finishStepPaint);
    };
  }, [setPattern]);

  return stepPaintRef;
}
