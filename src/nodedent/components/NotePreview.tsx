import React from "react";
import { SectionCard } from "./FormControls";
import {
  cx,
  semanticActionButton,
  semanticChoiceControl,
  semanticReadOnlyOutput,
  semanticStatusSurface,
} from "./uiStyles";

export function NotePreview({
  noteMode,
  displayedNote,
  copied,
  copyError,
  onNoteModeChange,
  onCopyDisplayedNote,
  onDownloadDisplayedText,
}: {
  noteMode: string;
  displayedNote: string;
  copied: boolean;
  copyError?: string;
  onNoteModeChange: (mode: string) => void;
  onCopyDisplayedNote: () => void;
  onDownloadDisplayedText: () => void;
}) {
  return (
    <SectionCard title="Live note preview" className="lg:order-2 xl:order-none">
      <div role="tablist" aria-label="Note output format" className="mb-3 grid grid-cols-2 gap-2">
        {["compact", "full", "patient", "print", "event log", "json"].map((mode) => (
          <button
            type="button"
            role="tab"
            aria-selected={noteMode === mode}
            aria-controls="note-preview-output"
            key={mode}
            onClick={() => onNoteModeChange(mode)}
            className={cx(noteMode === mode ? semanticChoiceControl.selected : semanticChoiceControl.unselected, "w-full capitalize")}
          >
            <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, noteMode === mode ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
            {mode === "json" ? "NodeDent JSON" : mode}
          </button>
        ))}
      </div>
      <div id="note-preview-output" role="tabpanel" aria-label={`${noteMode} note output`}>
        <textarea readOnly value={displayedNote} aria-label={`${noteMode} note output text`} className={cx(semanticReadOnlyOutput, "h-[420px]")} />
      </div>
      <p className={cx(semanticStatusSurface.attention, "mt-3 rounded-xl px-3 py-2 text-xs leading-5")}>Copying or downloading creates plaintext clinical data. Verify the chart number and destination in ClearDent or Dentrix, which remains the official record.</p>
      {copyError ? <p role="alert" className={cx(semanticStatusSurface.danger, "mt-3 rounded-xl px-3 py-2 text-xs leading-5")}>{copyError}</p> : null}
      {noteMode === "print" ? <button type="button" onClick={() => window.print()} className={cx(semanticActionButton.secondaryLarge, "mt-3 w-full")}>Print browser page</button> : null}
      <button type="button" onClick={onDownloadDisplayedText} className={cx(semanticActionButton.warningLarge, "mt-3 w-full")}>{noteMode === "json" ? "Download plaintext case JSON" : "Download plaintext .txt"}</button>
      <button type="button" onClick={onCopyDisplayedNote} className={cx(semanticActionButton.warningLarge, "mt-3 w-full")}><span aria-live="polite">{copied ? "Copied" : "Copy current output"}</span></button>
    </SectionCard>
  );
}
