"use client";

import { useSyncExternalStore } from "react";

/** Matches Tailwind `sm` (640px): compact grid below this width. */
const QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Server / very first paint: assume full grid; client immediately uses real viewport width. */
function getServerSnapshot(): boolean {
  return false;
}

export function useCompactStepGrid(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
