import React, { useState } from "react";
import type {
  ClinicalVaultBackup,
  EncryptedBackupImportPreview,
  EncryptedBackupImportResult,
} from "../state/clinicalVault";

const MAX_ENCRYPTED_BACKUP_BYTES = 50 * 1024 * 1024;

export function BackupRecoveryPanel({
  onDownloadEncryptedVaultBackup,
  onPreviewEncryptedBackupImport,
  onImportNewCasesFromEncryptedBackup,
  onLockForRestore,
}: {
  onDownloadEncryptedVaultBackup: () => void;
  onPreviewEncryptedBackupImport: (backup: ClinicalVaultBackup, passphrase: string) => Promise<EncryptedBackupImportPreview>;
  onImportNewCasesFromEncryptedBackup: (backup: ClinicalVaultBackup, passphrase: string) => Promise<EncryptedBackupImportResult>;
  onLockForRestore: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [backup, setBackup] = useState<ClinicalVaultBackup | null>(null);
  const [preview, setPreview] = useState<EncryptedBackupImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function resetPreview() {
    setBackup(null);
    setPreview(null);
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
    } catch (cause) {
      setBackup(null);
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Encrypted backup preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function importNewCases() {
    if (!backup || !preview?.additions) return;
    if (!window.confirm(`Import ${preview.additions} new encrypted encounter${preview.additions === 1 ? "" : "s"}? Existing encounter IDs will not be changed.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await onImportNewCasesFromEncryptedBackup(backup, passphrase);
      setPreview(result);
      setMessage(`Import complete: ${result.imported} added, ${result.skipped} skipped, ${result.failed} failed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Encrypted backup import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4">
      <h3 className="text-sm font-semibold text-brand-navy">Backup and recovery</h3>
      <p className="mt-1 text-xs leading-5 text-brand-slate">
        Download a complete encrypted vault backup, or preview and add only encounter IDs that are not already in this vault.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onDownloadEncryptedVaultBackup} className="rounded-xl border border-brand-mint bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-mint/20">
          Download encrypted backup
        </button>
        <button type="button" onClick={onLockForRestore} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-light-slate">
          Lock vault to restore and replace
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-brand-blue-light/60 bg-white p-3">
        <p className="text-sm font-semibold text-brand-navy">Import new cases from encrypted backup</p>
        <p className="mt-1 text-xs leading-5 text-brand-slate">The backup is authenticated and fully validated before any case is added. Existing encounter IDs are previewed and skipped.</p>
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
                Existing IDs: {preview.sameRevision} same revision, {preview.incomingNewer} newer in backup, {preview.incomingOlder} older in backup. All are left unchanged in this first import version.
              </p>
            ) : null}
            <button type="button" disabled={busy || !preview.additions} onClick={() => void importNewCases()} className="mt-2 rounded-lg border border-brand-navy bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate">
              Import {preview.additions} new encounter{preview.additions === 1 ? "" : "s"}
            </button>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {message ? <p role="status" className="mt-3 rounded-xl border border-brand-mint/40 bg-brand-mint/10 px-3 py-2 text-sm text-brand-navy">{message}</p> : null}
      </div>
    </div>
  );
}
