import React, { useEffect, useRef, useState } from "react";
import type {
  BackupConflictResolution,
  ClinicalVaultBackup,
  EncryptedBackupImportPreview,
  EncryptedBackupResolutionResult,
  RecoveryHistorySummary,
} from "../state/clinicalVault";
import { CLINICAL_VAULT_MIN_PASSPHRASE_LENGTH } from "../state/clinicalVaultCrypto";
import { FilePickerControl } from "./FilePickerControl";
import { ImportDisclosure } from "./ImportDisclosure";
import { SandboxDataWarning } from "./SandboxDataWarning";
import {
  cx,
  semanticActionButton,
  semanticFormControl,
  semanticStatusSurface,
  statusBadge,
} from "./uiStyles";

const MAX_ENCRYPTED_BACKUP_BYTES = 50 * 1024 * 1024;
const AUTO_PREVIEW_DELAY_MS = 500;

export function canAutoPreviewEncryptedBackup(hasFile: boolean, passphrase: string) {
  return hasFile && passphrase.length >= CLINICAL_VAULT_MIN_PASSPHRASE_LENGTH;
}

export function BackupRecoveryPanel({
  onDownloadEncryptedVaultBackup,
  onPreviewEncryptedBackupImport,
  onResolveEncryptedBackupImport,
  recoveryHistory,
  activeEncounterId,
  onRestoreRecoveryHistoryEntry,
  onLockForRestore,
}: {
  onDownloadEncryptedVaultBackup: () => void;
  onPreviewEncryptedBackupImport: (backup: ClinicalVaultBackup, passphrase: string) => Promise<EncryptedBackupImportPreview>;
  onResolveEncryptedBackupImport: (backup: ClinicalVaultBackup, passphrase: string, resolutions: BackupConflictResolution[]) => Promise<EncryptedBackupResolutionResult>;
  recoveryHistory: RecoveryHistorySummary[];
  activeEncounterId: string;
  onRestoreRecoveryHistoryEntry: (id: string) => Promise<void>;
  onLockForRestore: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [backup, setBackup] = useState<ClinicalVaultBackup | null>(null);
  const [preview, setPreview] = useState<EncryptedBackupImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, BackupConflictResolution["action"]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewRequestId = useRef(0);
  const previewJob = useRef<Promise<void>>(Promise.resolve());
  const previewImportRef = useRef(onPreviewEncryptedBackupImport);

  useEffect(() => {
    previewImportRef.current = onPreviewEncryptedBackupImport;
  }, [onPreviewEncryptedBackupImport]);

  function resetPreview() {
    setBackup(null);
    setPreview(null);
    setDecisions({});
    setPreviewError("");
    setIsPreviewing(false);
    setError("");
    setMessage("");
    previewRequestId.current += 1;
  }

  useEffect(() => {
    const requestId = ++previewRequestId.current;
    if (!file || !canAutoPreviewEncryptedBackup(true, passphrase)) return;

    const timeoutId = window.setTimeout(() => {
      setIsPreviewing(true);
      setPreviewError("");
      setError("");
      setMessage("");

      previewJob.current = previewJob.current.then(async () => {
        if (previewRequestId.current !== requestId) return;
        try {
          if (file.size > MAX_ENCRYPTED_BACKUP_BYTES) throw new Error("Encrypted vault backups are limited to 50 MB.");
          const fileText = await file.text();
          if (previewRequestId.current !== requestId) return;
          const parsed = JSON.parse(fileText) as ClinicalVaultBackup;
          const nextPreview = await previewImportRef.current(parsed, passphrase);
          if (previewRequestId.current !== requestId) return;
          setBackup(parsed);
          setPreview(nextPreview);
          setDecisions(Object.fromEntries(nextPreview.conflicts.map((conflict) => [conflict.encounterId, "keepLocal"])));
        } catch (cause) {
          if (previewRequestId.current !== requestId) return;
          setBackup(null);
          setPreview(null);
          setDecisions({});
          setPreviewError(cause instanceof Error ? cause.message : "Encrypted backup preview failed.");
        } finally {
          if (previewRequestId.current === requestId) setIsPreviewing(false);
        }
      });
    }, AUTO_PREVIEW_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (previewRequestId.current === requestId) previewRequestId.current += 1;
    };
  }, [file, passphrase, previewRetry]);

  async function applyReviewedImport() {
    if (!backup || !preview || (!preview.additions && !preview.conflicts.length)) return;
    const replacements = preview.conflicts.filter((conflict) => decisions[conflict.encounterId] === "replaceWithBackup").length;
    const confirmation = replacements
      ? `Apply this recovery plan? ${preview.additions} new encounter(s) will be added and ${replacements} local encounter(s) will be replaced after their current versions are archived in encrypted recovery history.`
      : `Import ${preview.additions} new encounter(s) and keep or defer all reviewed local conflicts?`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const resolutions = preview.conflicts.map((conflict): BackupConflictResolution => ({
        encounterId: conflict.encounterId,
        action: decisions[conflict.encounterId] || "keepLocal",
        expectedLocalRevision: conflict.local.revision,
        localDigest: conflict.localDigest,
        incomingDigest: conflict.incomingDigest,
      }));
      const result = await onResolveEncryptedBackupImport(backup, passphrase, resolutions);
      const nextPreview = await onPreviewEncryptedBackupImport(backup, passphrase);
      setPreview(nextPreview);
      setDecisions(Object.fromEntries(nextPreview.conflicts.map((conflict) => [conflict.encounterId, "keepLocal"])));
      setMessage(`Recovery complete: ${result.imported} added, ${result.replaced} replaced, ${result.archived} archived, ${result.keptLocal} kept local, ${result.deferred} deferred, ${result.identicalSkipped} identical skipped, ${result.failed} failed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Encrypted backup import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreHistoryEntry(entry: RecoveryHistorySummary) {
    if (entry.encounterId === activeEncounterId) return;
    if (!window.confirm(`Restore archived revision ${entry.revision} for chart ${entry.patientNumber}? The current local version will first be archived in encrypted recovery history.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onRestoreRecoveryHistoryEntry(entry.id);
      setMessage(`Archived revision ${entry.revision} was restored as a new local revision. The displaced version remains in encrypted recovery history.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Encrypted recovery-history restore failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4">
      <h3 className="text-sm font-semibold text-brand-navy">Backup and recovery</h3>
      <p className="mt-1 text-xs leading-5 text-brand-slate">
        Download a complete encrypted vault backup, or compare another backup and explicitly resolve differing encounter versions.
      </p>
      <ImportDisclosure
        id="encrypted-backup-import"
        buttonLabel="Import encrypted backup"
        expanded={isImportOpen}
        onToggle={() => setIsImportOpen((open) => !open)}
        action={(
          <button type="button" onClick={onDownloadEncryptedVaultBackup} className={semanticActionButton.secondary}>
            Download encrypted backup
          </button>
        )}
      >
        <SandboxDataWarning className="mb-3" />
        <p className="mt-1 text-xs leading-5 text-brand-slate">The complete backup is authenticated and validated before comparison. The preview starts automatically after you choose a file and enter its original passphrase. New encounters are added; differing existing encounters stay local unless you explicitly replace them.</p>
        <div className="mt-3">
          <FilePickerControl
            label="Encrypted backup file"
            buttonLabel="Choose backup file"
            accept=".nodedent,application/json"
            fileName={file?.name}
            onFileSelect={(selectedFile) => {
              setFile(selectedFile || null);
              resetPreview();
            }}
          />
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold text-brand-navy">Original backup passphrase</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => {
              setPassphrase(event.target.value);
              resetPreview();
            }}
            className={semanticFormControl.default}
          />
        </label>
        {file && passphrase.length < CLINICAL_VAULT_MIN_PASSPHRASE_LENGTH ? (
          <p className="mt-2 text-xs leading-5 text-brand-slate">Enter the complete original passphrase to preview this backup automatically.</p>
        ) : null}
        {isPreviewing ? <p role="status" className="mt-3 text-sm font-semibold text-brand-slate">Previewing encrypted backup…</p> : null}
        {previewError ? (
          <div role="alert" className={cx(semanticStatusSurface.danger, "mt-3 rounded-xl px-3 py-2 text-sm")}>
            <p>{previewError}</p>
            <button type="button" onClick={() => setPreviewRetry((attempt) => attempt + 1)} className={cx(semanticActionButton.secondaryCompact, "mt-2")}>
              Retry preview
            </button>
          </div>
        ) : null}
        {preview ? (
          <div className="mt-3 rounded-xl border border-brand-light-node bg-brand-light-slate p-3">
            <p className="text-sm font-semibold text-brand-navy">Import preview</p>
            <p className="mt-1 text-xs leading-5 text-brand-slate">
              Format {preview.formatVersion} · exported {new Date(preview.exportedAt).toLocaleString()} · {preview.totalCases} total · {preview.additions} new · {preview.existingEncounterIds} existing
            </p>
            {preview.existingEncounterIds ? (
              <p className="mt-1 text-xs leading-5 text-brand-slate">
                Existing IDs: {preview.identicalContent} identical, {preview.conflicts.length} differing · revision comparison: {preview.sameRevision} same, {preview.incomingNewer} newer in backup, {preview.incomingOlder} older in backup.
              </p>
            ) : null}
            {preview.conflicts.map((conflict) => (
              <div key={conflict.encounterId} className={cx(semanticStatusSurface.attention, "mt-3 rounded-xl p-3")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Chart {conflict.local.patientNumber} · tooth {conflict.local.tooth}</p>
                    <p className="text-xs text-amber-900">{conflict.classification === "divergentSameRevision" ? "Same revision, different content" : conflict.classification === "incomingNewer" ? "Backup revision is newer; ancestry is unknown" : "Backup revision is older"}</p>
                  </div>
                  {conflict.activeEncounter ? <span className={cx(statusBadge.base, statusBadge.danger)}>Active encounter cannot be replaced</span> : null}
                </div>
                <div className="mt-2 grid gap-2 text-xs text-brand-slate sm:grid-cols-2">
                  <div className="rounded-lg border border-brand-light-node bg-white p-2">
                    <strong className="text-brand-navy">Local · revision {conflict.local.revision}</strong>
                    <span className="mt-1 block">Saved {new Date(conflict.local.savedAt).toLocaleString()}</span>
                    <span className="block">Workflow: {conflict.local.currentNodeId}</span>
                    <span className="block">{conflict.local.canals.length} canal(s) · {conflict.local.eventCount} event(s)</span>
                    <span className="block">Anesthesia {conflict.local.anesthesiaEntryCount} · radiographs {conflict.local.radiographEntryCount}</span>
                    <span className="block">Closure: {conflict.local.closure}</span>
                    <span className="block">Next visit: {conflict.local.nextVisitPlan}</span>
                  </div>
                  <div className="rounded-lg border border-brand-light-node bg-white p-2">
                    <strong className="text-brand-navy">Backup · revision {conflict.incoming.revision}</strong>
                    <span className="mt-1 block">Saved {new Date(conflict.incoming.savedAt).toLocaleString()}</span>
                    <span className="block">Workflow: {conflict.incoming.currentNodeId}</span>
                    <span className="block">{conflict.incoming.canals.length} canal(s) · {conflict.incoming.eventCount} event(s)</span>
                    <span className="block">Anesthesia {conflict.incoming.anesthesiaEntryCount} · radiographs {conflict.incoming.radiographEntryCount}</span>
                    <span className="block">Closure: {conflict.incoming.closure}</span>
                    <span className="block">Next visit: {conflict.incoming.nextVisitPlan}</span>
                  </div>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-950">
                  {conflict.differences.map((difference) => <li key={difference}>{difference}</li>)}
                </ul>
                <fieldset className="mt-3 flex flex-wrap gap-3 text-xs text-brand-navy">
                  <legend className="sr-only">Resolution for encounter {conflict.encounterId}</legend>
                  {([
                    ["keepLocal", "Keep local"],
                    ["replaceWithBackup", "Replace with backup"],
                    ["defer", "Decide later"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className={`flex items-center gap-1 ${value === "replaceWithBackup" && conflict.activeEncounter ? "cursor-not-allowed opacity-50" : ""}`}>
                      <input
                        type="radio"
                        name={`backup-resolution-${conflict.encounterId}`}
                        value={value}
                        checked={(decisions[conflict.encounterId] || "keepLocal") === value}
                        disabled={value === "replaceWithBackup" && conflict.activeEncounter}
                        onChange={() => setDecisions((current) => ({ ...current, [conflict.encounterId]: value }))}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </div>
            ))}
            <button type="button" disabled={busy || (!preview.additions && !preview.conflicts.length)} onClick={() => void applyReviewedImport()} className={cx(semanticActionButton.primaryCompact, "mt-3")}>
              Apply reviewed import
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 border-t border-brand-light-node pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-brand-slate">
            <strong className="text-brand-navy">Full vault restore:</strong> lock the vault before replacing the complete local vault or resolving a conflict involving the active encounter.
          </p>
          <button type="button" onClick={onLockForRestore} className={cx(semanticActionButton.secondary, "shrink-0")}>
            Lock vault to restore
          </button>
        </div>
      </ImportDisclosure>
      {error ? <p role="alert" className={cx(semanticStatusSurface.danger, "mt-3 rounded-xl px-3 py-2 text-sm")}>{error}</p> : null}
      {message ? <p role="status" className={cx(semanticStatusSurface.positive, "mt-3 rounded-xl px-3 py-2 text-sm")}>{message}</p> : null}
      {recoveryHistory.length ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
          <p className="text-sm font-semibold text-brand-navy">Encrypted recovery history</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">Versions displaced by an explicit recovery replacement remain encrypted, are included in new vault backups, and are removed when their encounter or the entire vault is deleted.</p>
          <ul aria-label="Encrypted recovery history versions" className="mt-2 space-y-2">
            {recoveryHistory.map((entry) => {
              const active = entry.encounterId === activeEncounterId;
              return (
                <li key={entry.id} className="flex flex-col gap-2 rounded-lg border border-brand-light-node bg-brand-light-slate p-2 text-xs text-brand-slate sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <strong className="text-brand-navy">Chart {entry.patientNumber} · tooth {entry.tooth} · revision {entry.revision}</strong>
                    <span className="mt-1 block">Archived {new Date(entry.archivedAt).toLocaleString()} · {entry.reason === "recovery-history-restoration" ? "history restoration" : "backup conflict replacement"}</span>
                  </span>
                  <button type="button" disabled={busy || active} onClick={() => void restoreHistoryEntry(entry)} className={semanticActionButton.warningCompact}>
                    {active ? "Close active encounter first" : "Restore archived version"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className={cx(semanticStatusSurface.neutral, "mt-3 rounded-xl px-3 py-2 text-xs")}>
          <strong className="text-brand-navy">Encrypted recovery history:</strong> No displaced versions are stored.
        </p>
      )}
    </div>
  );
}
