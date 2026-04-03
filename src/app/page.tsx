import { DrumMachine } from "@/components/DrumMachine";

export default function Home() {
  return (
    <div className="mx-auto box-border flex h-[min(586px,100dvh)] w-full max-w-[min(1209px,100%)] flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <DrumMachine />
    </div>
  );
}
