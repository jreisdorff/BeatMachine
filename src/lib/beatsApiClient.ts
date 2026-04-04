import type { BeatsDocument, SavedBeat } from "@/lib/beatsShared";

type ApiOk = { ok: true; doc: BeatsDocument };
type ApiErr = { ok: false; error: string; status: number };

export type BeatsApiResult = ApiOk | ApiErr;

async function post(body: Record<string, unknown>): Promise<BeatsApiResult> {
  let res: Response;
  try {
    res = await fetch("/api/beats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Network error", status: 0 };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: res.statusText || "Bad response", status: res.status };
  }
  if (!res.ok) {
    const err =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  if (
    typeof data === "object" &&
    data &&
    "doc" in data &&
    (data as { doc: BeatsDocument }).doc
  ) {
    return { ok: true, doc: (data as { doc: BeatsDocument }).doc };
  }
  return { ok: false, error: "Invalid server response", status: res.status };
}

export function fetchBeatsDoc(): Promise<BeatsApiResult> {
  return post({ action: "list" });
}

export function createBeatOnServer(
  beat: Omit<SavedBeat, "id">,
): Promise<BeatsApiResult> {
  return post({
    action: "create",
    name: beat.name,
    bpm: beat.bpm,
    swing: beat.swing,
    pattern: beat.pattern,
  });
}

export function setActiveBeatOnServer(beatId: string): Promise<BeatsApiResult> {
  return post({ action: "setActive", beatId });
}
