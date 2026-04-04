"use client";

import type { SavedBeat } from "@/lib/beatsShared";

type DrumMachineSavedBeatsProps = {
  savedBeats: SavedBeat[];
  activeBeatId: string | null;
  onSelectBeat: (id: string) => void;
  beatsBusy: boolean;
  onOpenSaveModal: () => void;
};

export function DrumMachineSavedBeats({
  savedBeats,
  activeBeatId,
  onSelectBeat,
  beatsBusy,
  onOpenSaveModal,
}: DrumMachineSavedBeatsProps) {
  return (
    <div className="mt-1.5 flex shrink-0 flex-col items-center gap-1.5 border-t border-zinc-200 pt-1.5 text-center dark:border-zinc-800">
      <label className="flex w-full max-w-xs flex-col items-center gap-0.5 text-[10px] text-zinc-700 dark:text-zinc-300">
        <span className="font-medium">Saved Beats</span>
        <select
          value={activeBeatId ?? ""}
          disabled={savedBeats.length === 0}
          onChange={(e) => void onSelectBeat(e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-1 py-0.5 text-[10px] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
        onClick={onOpenSaveModal}
        disabled={beatsBusy}
        className="rounded border border-emerald-600 bg-emerald-600 px-3 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Save Beat
      </button>
      <p className="max-w-xs text-[8px] leading-tight text-zinc-500 dark:text-zinc-500">
        Beats are stored and shared by all visitors.
      </p>
    </div>
  );
}
