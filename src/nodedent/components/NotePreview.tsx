import React from "react";
import { SectionCard } from "./FormControls";

export function NotePreview({
  noteMode,
  displayedNote,
  copied,
  onNoteModeChange,
  onCopyDisplayedNote,
}: {
  noteMode: string;
  displayedNote: string;
  copied: boolean;
  onNoteModeChange: (mode: string) => void;
  onCopyDisplayedNote: () => void;
}) {
  return (
    <SectionCard title="Live note preview" className="lg:order-2 xl:order-none">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {["compact", "full", "patient", "print", "event log", "json"].map((mode) => (
          <button key={mode} onClick={() => onNoteModeChange(mode)} className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${noteMode === mode ? "bg-brand-navy text-white" : "border border-brand-light-node bg-brand-light-slate text-brand-slate hover:bg-brand-light-node"}`}>{mode}</button>
        ))}
      </div>
      <textarea readOnly value={displayedNote} className="h-[420px] w-full resize-none rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 font-mono text-xs leading-5 text-brand-navy outline-none" />
      {noteMode === "print" ? <button onClick={() => window.print()} className="mt-3 w-full rounded-xl border border-brand-light-node bg-white px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-brand-light-slate">Print browser page</button> : null}
      <button onClick={onCopyDisplayedNote} className="mt-3 w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-deep">{copied ? "Copied" : "Copy current output"}</button>
    </SectionCard>
  );
}
