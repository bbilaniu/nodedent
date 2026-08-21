import React, { useState } from "react";
import type {
  BackupConflictResolution,
  ClinicalVaultBackup,
  EncryptedBackupImportPreview,
  EncryptedBackupResolutionResult,
  RecoveryHistorySummary,
} from "../state/clinicalVault";

const MAX_ENCRYPTED_BACKUP_BYTES = 50 * 1024 * 1024;

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

  function resetPreview() {
    setBackup(null);
    setPreview(null);
    setDecisions({});
    setError("");
    setMessage("");
  }

  async function previewImport() {
    if (!file) {
      setError("Choose an encrypted NodeDent backup file.");
      return;
    }
    if (!passphrase) {
      setError("Enter the original passphrase for this encrypted backup.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_ENCRYPTED_BACKUP_BYTES) throw new Error("Encrypted vault backups are limited to 50 MB.");
      const parsed = JSON.parse(await file.text()) as ClinicalVaultBackup;
      const nextPreview = await onPreviewEncryptedBackupImport(parsed, passphrase);
      setBackup(parsed);
      setPreview(nextPreview);
      setDecisions(Object.fromEntries(nextPreview.conflicts.map((conflict) => [conflict.encounterId, "keepLocal"])));
    } catch (cause) {
      setBackup(null);
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Encrypted backup preview failed.");
    } finally {
      setBusy(false);
    }
  }

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
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onDownloadEncryptedVaultBackup} className="rounded-xl border border-brand-mint bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-mint/20">
          Download encrypted backup
        </button>
        <button type="button" onClick={onLockForRestore} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-light-slate">
          Lock vault for restore or active conflict
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-brand-blue-light/60 bg-white p-3">
        <p className="text-sm font-semibold text-brand-navy">Import and resolve encrypted backup</p>
        <p className="mt-1 text-xs leading-5 text-brand-slate">The complete backup is authenticated and validated before comparison. New encounters are added; differing existing encounters stay local unless you explicitly replace them.</p>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-brand-slate">Encrypted backup file</span>
          <input
            type="file"
            accept=".nodedent,application/json"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              resetPreview();
            }}
            className="block w-full text-sm text-brand-slate"
          />
        </label>
        {file ? <p className="mt-1 text-xs text-brand-slate">Selected: {file.name}</p> : null}
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-brand-slate">Original backup passphrase</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => {
              setPassphrase(event.target.value);
              resetPreview();
            }}
            className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void previewImport()} className="mt-3 rounded-lg border border-brand-blue-light bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-blue-light/20 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Working…" : "Preview encrypted import"}
        </button>
        {preview ? (
          <div className="mt-3 rounded-xl border border-brand-light-node bg-brand-light-slate p-3">
            <p className="text-sm font-semibold text-brand-navy">Backup import preview</p>
            <p className="mt-1 text-xs leading-5 text-brand-slate">
              Format {preview.formatVersion} · exported {new Date(preview.exportedAt).toLocaleString()} · {preview.totalCases} total · {preview.additions} new · {preview.existingEncounterIds} existing
            </p>
            {preview.existingEncounterIds ? (
              <p className="mt-1 text-xs leading-5 text-brand-slate">
                Existing IDs: {preview.identicalContent} identical, {preview.conflicts.length} differing · revision comparison: {preview.sameRevision} same, {preview.incomingNewer} newer in backup, {preview.incomingOlder} older in backup.
              </p>
            ) : null}
            {preview.conflicts.map((conflict) => (
              <div key={conflict.encounterId} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Chart {conflict.local.patientNumber} · tooth {conflict.local.tooth}</p>
                    <p className="text-xs text-amber-900">{conflict.classification === "divergentSameRevision" ? "Same revision, different content" : conflict.classification === "incomingNewer" ? "Backup revision is newer; ancestry is unknown" : "Backup revision is older"}</p>
                  </div>
                  {conflict.activeEncounter ? <span className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-800">Active encounter cannot be replaced</span> : null}
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
            <button type="button" disabled={busy || (!preview.additions && !preview.conflicts.length)} onClick={() => void applyReviewedImport()} className="mt-3 rounded-lg border border-brand-navy bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate">
              Apply reviewed import
            </button>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {message ? <p role="status" className="mt-3 rounded-xl border border-brand-mint/40 bg-brand-mint/10 px-3 py-2 text-sm text-brand-navy">{message}</p> : null}
      </div>
      <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
        <p className="text-sm font-semibold text-brand-navy">Encrypted recovery history</p>
        <p className="mt-1 text-xs leading-5 text-brand-slate">Versions displaced by an explicit recovery replacement remain encrypted, are included in new vault backups, and are removed when their encounter or the entire vault is deleted.</p>
        {recoveryHistory.length ? (
          <div className="mt-2 space-y-2">
            {recoveryHistory.map((entry) => {
              const active = entry.encounterId === activeEncounterId;
              return (
                <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-brand-light-node bg-brand-light-slate p-2 text-xs text-brand-slate sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <strong className="text-brand-navy">Chart {entry.patientNumber} · tooth {entry.tooth} · revision {entry.revision}</strong>
                    <span className="mt-1 block">Archived {new Date(entry.archivedAt).toLocaleString()} · {entry.reason === "recovery-history-restoration" ? "history restoration" : "backup conflict replacement"}</span>
                  </span>
                  <button type="button" disabled={busy || active} onClick={() => void restoreHistoryEntry(entry)} className="rounded-lg border border-brand-blue-light bg-white px-3 py-2 font-semibold text-brand-navy hover:bg-brand-blue-light/20 disabled:cursor-not-allowed disabled:opacity-50">
                    {active ? "Close active encounter first" : "Restore archived version"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : <p className="mt-2 text-xs text-brand-slate">No displaced versions are stored.</p>}
      </div>
    </div>
  );
}
