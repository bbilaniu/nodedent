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
          <button key={mode} onClick={() => onNoteModeChange(mode)} className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${noteMode === mode ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{mode}</button>
        ))}
      </div>
      <textarea readOnly value={displayedNote} className="h-[420px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-800 outline-none" />
      {noteMode === "print" ? <button onClick={() => window.print()} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Print browser page</button> : null}
      <button onClick={onCopyDisplayedNote} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{copied ? "Copied" : "Copy current output"}</button>
    </SectionCard>
  );
}
