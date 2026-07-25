import React from "react";
import { SectionCard } from "./FormControls";

export function NotePreview({
  noteMode,
  displayedNote,
  copied,
  copyError,
  hasClinicalActivity = true,
  onNoteModeChange,
  onCopyDisplayedNote,
  onDownloadDisplayedText,
}: {
  noteMode: string;
  displayedNote: string;
  copied: boolean;
  copyError?: string;
  hasClinicalActivity?: boolean;
  onNoteModeChange: (mode: string) => void;
  onCopyDisplayedNote: () => void;
  onDownloadDisplayedText: () => void;
}) {
  const isChartNoteMode = noteMode === "compact" || noteMode === "full";

  return (
    <SectionCard title="Draft chart note" className="lg:order-2 xl:order-none">
      <p className="mb-3 text-xs leading-5 text-brand-slate">
        Generated from the current appointment record and updated as documentation changes. This preview is not a finalized or signed appointment note.
      </p>
      {!hasClinicalActivity ? (
        <div className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <p className="text-sm font-semibold text-brand-navy">No clinical activity recorded yet.</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">Select a workflow or record appointment context before reviewing a draft chart note.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {["compact", "full", "patient", "print", "event log", "json"].map((mode) => (
              <button key={mode} onClick={() => onNoteModeChange(mode)} className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${noteMode === mode ? "bg-brand-navy text-white" : "border border-brand-light-node bg-brand-light-slate text-brand-slate hover:bg-brand-light-node"}`}>{mode === "json" ? "NodeDent JSON" : mode}</button>
            ))}
          </div>
          <textarea aria-label="Draft chart note preview" readOnly value={displayedNote} className="h-[420px] w-full resize-none rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 font-mono text-xs leading-5 text-brand-navy outline-none" />
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Copying or downloading creates plaintext clinical data. Verify the chart number and destination in ClearDent or Dentrix, which remains the official record.</p>
          {copyError ? <p role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs leading-5 text-red-900">{copyError}</p> : null}
          {noteMode === "print" ? <button onClick={() => window.print()} className="mt-3 w-full rounded-xl border border-brand-light-node bg-white px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-brand-light-slate">Print browser page</button> : null}
          <button onClick={onDownloadDisplayedText} className="mt-3 w-full rounded-xl border border-brand-light-node bg-white px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-brand-light-slate">
            {noteMode === "json" ? "Download plaintext case JSON" : isChartNoteMode ? "Download draft note .txt" : "Download plaintext .txt"}
          </button>
          <button onClick={onCopyDisplayedNote} className="mt-3 w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-deep">
            {copied ? "Copied" : isChartNoteMode ? "Copy draft note" : "Copy current output"}
          </button>
        </>
      )}
    </SectionCard>
  );
}
