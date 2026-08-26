import React, { useState } from "react";
import type { EndoCase, PriorCanalStatus } from "../types";
import { priorCanalStatusLabels } from "../engine/resume";
import { blankCanal, makeDefaultNewCanalName } from "../state/persistence";
import type { SavedCaseSummary } from "../state/clinicalVault";
import { SelectInput, TextInput } from "./FormControls";
import { ClinicalDataNotice } from "./ClinicalDataNotice";
import { FilePickerControl } from "./FilePickerControl";
import { BackupRecoveryPanel } from "./BackupRecoveryPanel";
import type { BackupConflictResolution, ClinicalVaultBackup, EncryptedBackupImportPreview, EncryptedBackupResolutionResult, RecoveryHistorySummary } from "../state/clinicalVault";
import { SandboxDataWarning } from "./SandboxDataWarning";
import { cx, semanticActionButton, semanticDialogSurface, semanticFormControl, semanticSelectionTone, semanticStatusSurface, semanticStatusTone, statusBadge } from "./uiStyles";

const MAX_CASE_JSON_BYTES = 1_000_000;

export function SavedCasesModal({
  savedCases,
  importText,
  showImportBox,
  onClose,
  onToggleImportBox,
  onImportTextChange,
  onImportCaseJson,
  onClearSavedCurrentCase,
  onResetAllSavedCases,
  onLoadSavedCase,
  onDeleteSavedCase,
  onDownloadEncryptedVaultBackup,
  onPreviewEncryptedBackupImport,
  onResolveEncryptedBackupImport,
  recoveryHistory,
  activeEncounterId,
  onRestoreRecoveryHistoryEntry,
  onLockForRestore,
}: {
  savedCases: SavedCaseSummary[];
  importText: string;
  showImportBox: boolean;
  onClose: () => void;
  onToggleImportBox: () => void;
  onImportTextChange: (value: string) => void;
  onImportCaseJson: () => void;
  onClearSavedCurrentCase: () => void;
  onResetAllSavedCases: () => void;
  onLoadSavedCase: (caseId: string) => void;
  onDeleteSavedCase: (caseId: string) => void;
  onDownloadEncryptedVaultBackup: () => void;
  onPreviewEncryptedBackupImport: (backup: ClinicalVaultBackup, passphrase: string) => Promise<EncryptedBackupImportPreview>;
  onResolveEncryptedBackupImport: (backup: ClinicalVaultBackup, passphrase: string, resolutions: BackupConflictResolution[]) => Promise<EncryptedBackupResolutionResult>;
  recoveryHistory: RecoveryHistorySummary[];
  activeEncounterId: string;
  onRestoreRecoveryHistoryEntry: (id: string) => Promise<void>;
  onLockForRestore: () => void;
}) {
  const [importFileName, setImportFileName] = useState("");
  const [importFileError, setImportFileError] = useState("");

  async function selectImportFile(file?: File) {
    setImportFileName("");
    setImportFileError("");
    if (!file) return;

    try {
      if (file.size > MAX_CASE_JSON_BYTES) throw new Error("Case JSON exceeds the 1 MB import limit.");
      onImportTextChange(await file.text());
      setImportFileName(file.name);
    } catch (error) {
      onImportTextChange("");
      setImportFileError(error instanceof Error ? error.message : "Could not read the selected JSON file.");
    }
  }

  return (
    <div className={semanticDialogSurface.overlay}>
      <section role="dialog" aria-modal="true" aria-labelledby="saved-cases-dialog-title" className={cx(semanticDialogSurface.panel, "max-w-3xl")}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-blue">Saved cases</p>
            <h2 id="saved-cases-dialog-title" className="mt-1 text-2xl font-bold text-brand-navy">Resume saved workflow</h2>
            <p className="mt-1 text-sm text-brand-slate">Open an encrypted local autosave or explicitly import a NodeDent case JSON.</p>
          </div>
          <button type="button" onClick={onClose} className={semanticActionButton.secondary}>Close</button>
        </div>

        <ClinicalDataNotice compact />

        <div className="mt-4 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy">Case library actions</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={onToggleImportBox} className={semanticActionButton.warning}>Import case JSON</button>
            <div className="flex gap-2">
              <button type="button" onClick={onClearSavedCurrentCase} className={cx(semanticActionButton.destructiveCompact, "flex-1")}>Clear current</button>
              <button type="button" onClick={onResetAllSavedCases} className={cx(semanticActionButton.destructiveCompact, "flex-1")}>Reset all</button>
            </div>
          </div>
          {showImportBox ? (
            <div className="mt-3 rounded-xl border border-brand-blue-light/60 bg-white p-2">
              <p className={cx(semanticStatusSurface.attention, "mb-2 p-3 text-xs leading-5")}>Case JSON is plaintext clinical data. Import only an approved NodeDent case file; legacy browser storage is never migrated automatically.</p>
              <SandboxDataWarning className="mb-2" />
              <div className="rounded-lg border border-brand-blue-light/60 bg-brand-light-slate p-3">
                <FilePickerControl
                  label="NodeDent case JSON file"
                  buttonLabel="Choose case file"
                  accept=".json,application/json"
                  fileName={importFileName}
                  onFileSelect={(file) => void selectImportFile(file)}
                />
              </div>
              {importFileError ? <p role="alert" className="mt-2 text-xs font-semibold text-red-800">{importFileError}</p> : null}
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-brand-slate">Or paste case JSON</span>
                <textarea
                  value={importText}
                  onChange={(event) => {
                    setImportFileName("");
                    setImportFileError("");
                    onImportTextChange(event.target.value);
                  }}
                  placeholder="Paste explicitly exported NodeDent case JSON here"
                  className={cx(semanticFormControl.default, "h-28 font-mono text-xs")}
                />
              </label>
              <button type="button" onClick={onImportCaseJson} className={cx(semanticActionButton.warningCompact, "mt-2")}>Resume imported workflow</button>
            </div>
          ) : null}
        </div>

        <BackupRecoveryPanel
          onDownloadEncryptedVaultBackup={onDownloadEncryptedVaultBackup}
          onPreviewEncryptedBackupImport={onPreviewEncryptedBackupImport}
          onResolveEncryptedBackupImport={onResolveEncryptedBackupImport}
          recoveryHistory={recoveryHistory}
          activeEncounterId={activeEncounterId}
          onRestoreRecoveryHistoryEntry={onRestoreRecoveryHistoryEntry}
          onLockForRestore={onLockForRestore}
        />

        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">Recent autosaves</p>
          <ul aria-label="Recent case autosaves" className="grid gap-2 md:grid-cols-2">
            {savedCases.length ? savedCases.map((item) => (
              <li key={item.id} className="rounded-xl border border-brand-light-node bg-white p-2">
                <button type="button" onClick={() => onLoadSavedCase(item.id)} className={cx(semanticActionButton.secondary, "h-auto w-full flex-col items-start p-2 text-left text-xs text-brand-slate")}>
                  <strong>{item.patientNumber}</strong> · tooth {item.tooth} · {item.procedureType}
                  <span className="mt-1 block text-brand-slate">{new Date(item.autosavedAt).toLocaleString()} · {item.canalCount || 0} canal(s) · {item.eventCount || 0} event(s)</span>
                  {item.expired ? <span className={cx(statusBadge.base, semanticStatusTone.attention, "mt-2")}>Past retention review date</span> : null}
                  <span className="mt-2 block text-[11px] font-bold text-brand-navy">Resume saved workflow</span>
                </button>
                <button type="button" onClick={() => onDeleteSavedCase(item.id)} className={cx(semanticActionButton.destructiveCompact, "mt-2")}>Delete saved case</button>
              </li>
            )) : <li className="text-sm text-brand-slate">No autosaves yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

export function PriorVisitModal({
  caseData,
  onClose,
  onUpdateCase,
  onContinueFromPriorVisit,
  onResumeActiveCanalFromPriorVisit,
  canResumeActiveCanalFromPriorVisit,
}: {
  caseData: EndoCase;
  onClose: () => void;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onContinueFromPriorVisit: () => void;
  onResumeActiveCanalFromPriorVisit: () => void;
  canResumeActiveCanalFromPriorVisit: boolean;
}) {
  const [newPriorCanalName, setNewPriorCanalName] = useState("");
  const priorCanalStatusOptions = Object.entries(priorCanalStatusLabels) as [PriorCanalStatus, string][];
  const updatePriorVisit = (updates: Partial<NonNullable<EndoCase["priorVisit"]>>) => onUpdateCase({ priorVisit: { ...(caseData.priorVisit || {}), ...updates } });
  const updateCanal = (canalName: string, updates: Partial<EndoCase["canals"][number]>) => {
    onUpdateCase({ canals: caseData.canals.map((canal) => canal.name === canalName ? { ...canal, ...updates } : canal) });
  };
  const priorCanalCount = caseData.canals.filter((canal) => canal.priorVisitStatus || canal.priorVisitNote).length;
  const priorSummaryParts = [
    caseData.priorVisit?.continuedFromPriorVisit ? "Marked continued" : null,
    caseData.priorVisit?.accessPreviouslyOpened ? "access opened" : null,
    caseData.priorVisit?.temporaryRestorationPresent ? "temporary present" : null,
    caseData.priorVisit?.medicationPresent ? `medication ${caseData.priorVisit.medicationPresent}` : null,
    priorCanalCount ? `${priorCanalCount} canal(s) staged` : null,
  ].filter(Boolean);

  function addPriorCanal() {
    const typedName = newPriorCanalName.trim();
    const canalName = typedName ? typedName.toUpperCase() : makeDefaultNewCanalName(caseData.canals).toUpperCase();
    if (caseData.canals.some((canal) => canal.name === canalName)) {
      setNewPriorCanalName("");
      return;
    }
    onUpdateCase({
      currentCanal: caseData.currentCanal || canalName,
      priorVisit: { ...(caseData.priorVisit || {}), continuedFromPriorVisit: true },
      canals: [...caseData.canals, blankCanal(canalName)],
    });
    setNewPriorCanalName("");
  }

  function renameCanal(oldName: string, nextValue: string) {
    const nextName = nextValue.trim().toUpperCase();
    if (!nextName || nextName === oldName || caseData.canals.some((canal) => canal.name === nextName)) return;
    onUpdateCase({
      currentCanal: caseData.currentCanal === oldName ? nextName : caseData.currentCanal,
      canals: caseData.canals.map((canal) =>
        canal.name === oldName
          ? { ...canal, name: nextName, events: (canal.events || []).map((event) => ({ ...event, canal: nextName })) }
          : canal
      ),
      globalEvents: caseData.globalEvents.map((event) => event.canal === oldName ? { ...event, canal: nextName } : event),
    });
  }

  function deleteCanal(canalName: string) {
    if (caseData.canals.length <= 1) return;
    const remainingCanals = caseData.canals.filter((canal) => canal.name !== canalName);
    onUpdateCase({
      currentCanal: caseData.currentCanal === canalName ? remainingCanals[0]?.name || "" : caseData.currentCanal,
      canals: remainingCanals,
      globalEvents: caseData.globalEvents.filter((event) => event.canal !== canalName),
    });
  }

  return (
    <div className={semanticDialogSurface.overlay}>
      <section role="dialog" aria-modal="true" aria-labelledby="prior-visit-dialog-title" className={cx(semanticDialogSurface.panel, "max-w-4xl")}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Prior visit</p>
            <h2 id="prior-visit-dialog-title" className="mt-1 text-2xl font-bold text-brand-navy">Fast-forward from previous treatment</h2>
            <p className="mt-1 text-sm text-brand-slate">{priorSummaryParts.length ? priorSummaryParts.join(" · ") : "No prior visit history staged."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onContinueFromPriorVisit} className={semanticActionButton.primaryCompact}>Mark as continued from a prior visit</button>
            <button type="button" onClick={onClose} className={semanticActionButton.secondaryCompact}>Close</button>
          </div>
        </div>

        <ClinicalDataNotice compact />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextInput label="Prior visit date / timing" value={caseData.priorVisit?.priorVisitDate || ""} onChange={(value) => updatePriorVisit({ priorVisitDate: value })} placeholder="optional" />
          <SelectInput label="Medication present" value={caseData.priorVisit?.medicationPresent || ""} onChange={(value) => updatePriorVisit({ medicationPresent: value as NonNullable<EndoCase["priorVisit"]>["medicationPresent"] })} options={["", "yes", "no", "unknown"]} />
          <label className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", caseData.priorVisit?.accessPreviouslyOpened ? semanticSelectionTone.selected : semanticSelectionTone.unselected)}>
            <input type="checkbox" checked={Boolean(caseData.priorVisit?.accessPreviouslyOpened)} onChange={(event) => updatePriorVisit({ accessPreviouslyOpened: event.target.checked, continuedFromPriorVisit: true })} />
            Access previously opened
          </label>
          <label className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", caseData.priorVisit?.temporaryRestorationPresent ? semanticSelectionTone.selected : semanticSelectionTone.unselected)}>
            <input type="checkbox" checked={Boolean(caseData.priorVisit?.temporaryRestorationPresent)} onChange={(event) => updatePriorVisit({ temporaryRestorationPresent: event.target.checked, continuedFromPriorVisit: true })} />
            Temporary restoration present
          </label>
          <label className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", caseData.priorVisit?.priorRadiographsAvailable ? semanticSelectionTone.selected : semanticSelectionTone.unselected)}>
            <input type="checkbox" checked={Boolean(caseData.priorVisit?.priorRadiographsAvailable)} onChange={(event) => updatePriorVisit({ priorRadiographsAvailable: event.target.checked, continuedFromPriorVisit: true })} />
            Prior radiographs / notes available
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-brand-slate">Prior history note / source</span>
            <textarea value={caseData.priorVisit?.sourceNote || ""} onChange={(event) => updatePriorVisit({ sourceNote: event.target.value, continuedFromPriorVisit: true })} placeholder="e.g., prior access, CaOH placed, temp restoration, outside notes reviewed" className={cx(semanticFormControl.default, "h-20")} />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-brand-navy">Prior canals</h3>
              <p className="mt-1 text-sm text-brand-slate">Use the real canal names from the previous visit, then stage each canal independently.</p>
            </div>
            <div className="flex gap-2">
              <input value={newPriorCanalName} onChange={(event) => setNewPriorCanalName(event.target.value)} placeholder="MB, ML, DB..." className={cx(semanticFormControl.default, "w-36")} />
              <button type="button" onClick={addPriorCanal} className={semanticActionButton.primaryCompact}>Add canal</button>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {caseData.canals.map((canal) => (
              <div key={canal.name} className="grid gap-2 rounded-xl border border-brand-light-node bg-white p-3 md:grid-cols-[120px_minmax(160px,220px)_minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-slate">Canal name</span>
                  <input defaultValue={canal.name} onBlur={(event) => renameCanal(canal.name, event.target.value)} className={cx(semanticFormControl.default, "font-bold text-brand-navy")} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-slate">Prior canal status</span>
                  <select value={canal.priorVisitStatus || ""} onChange={(event) => updateCanal(canal.name, { priorVisitStatus: event.target.value as PriorCanalStatus })} className={semanticFormControl.default}>
                    {priorCanalStatusOptions.map(([value, label]) => <option key={value || "not-set"} value={value}>{label}</option>)}
                  </select>
                </label>
                <TextInput label="Prior canal note" value={canal.priorVisitNote || ""} onChange={(value) => updateCanal(canal.name, { priorVisitNote: value })} placeholder="optional" />
                <button
                  type="button"
                  onClick={() => deleteCanal(canal.name)}
                  disabled={caseData.canals.length <= 1}
                  className={semanticActionButton.destructiveCompact}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onResumeActiveCanalFromPriorVisit}
            disabled={!canResumeActiveCanalFromPriorVisit}
            title={canResumeActiveCanalFromPriorVisit ? "Resume the active canal from prior-visit setup" : "Set up prior visit history or prior status for the active canal first"}
            className={semanticActionButton.primaryLarge}
          >
            Resume from prior visit setup
          </button>
        </div>
      </section>
    </div>
  );
}
