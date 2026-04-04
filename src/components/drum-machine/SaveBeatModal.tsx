"use client";

type SaveBeatModalProps = {
  open: boolean;
  onClose: () => void;
  saveNameInput: string;
  onSaveNameChange: (v: string) => void;
  beatsBusy: boolean;
  onSubmit: () => void;
};

export function SaveBeatModal({
  open,
  onClose,
  saveNameInput,
  onSaveNameChange,
  beatsBusy,
  onSubmit,
}: SaveBeatModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          Name this pattern. It is added to the shared Saved Beats.
        </p>
        <input
          type="text"
          value={saveNameInput}
          onChange={(e) => onSaveNameChange(e.target.value)}
          placeholder="Enter a name for your beat"
          maxLength={80}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") void onSubmit();
          }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={beatsBusy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
