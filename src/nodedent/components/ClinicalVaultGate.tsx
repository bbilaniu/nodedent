import React, { useEffect, useMemo, useState } from "react";
import {
  ClinicalVaultError,
  ClinicalVaultStore,
  requestPersistentClinicalStorage,
  type ClinicalVaultBackup,
  type ClinicalVaultSession,
} from "../state/clinicalVault";
import {
  buildLegacyClinicalStorageBackup,
  clearLegacyClinicalStorage,
  listLegacyClinicalStorageKeys,
} from "../state/legacyClinicalStorage";
import { PRIVACY_POLICY_HASH } from "./AppFooter";
import { FilePickerControl } from "./FilePickerControl";
import { SandboxDataWarning } from "./SandboxDataWarning";
import {
  cx,
  semanticActionButton,
  semanticChoiceControl,
  semanticFormControl,
  semanticInteraction,
  semanticStatusSurface,
} from "./uiStyles";

export type ClinicalVaultAccess = {
  session: ClinicalVaultSession;
  persistentStorage: boolean;
};

function downloadJson(value: unknown, filename: string, type = "application/json") {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown) {
  if (error instanceof ClinicalVaultError || error instanceof Error) return error.message;
  return "The clinical vault operation failed.";
}

export function getEncryptedBackupRestoreInputError(hasFile: boolean, passphrase: string) {
  if (!hasFile) return "Choose an encrypted NodeDent backup file.";
  if (!passphrase) return "Enter the original passphrase for this encrypted backup.";
  return "";
}

export function ClinicalVaultGate({
  onAccess,
  themeMode,
  onToggleTheme,
}: {
  onAccess: (access: ClinicalVaultAccess) => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const store = useMemo(() => {
    try {
      return new ClinicalVaultStore();
    } catch {
      return null;
    }
  }, []);
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreError, setRestoreError] = useState("");

  useEffect(() => {
    setLegacyKeys(listLegacyClinicalStorageKeys());
    if (!store) {
      setError("IndexedDB is unavailable. NodeDent cannot open protected clinical storage in this browser.");
      setHasVault(false);
      return;
    }
    store.hasVault().then(setHasVault).catch((cause) => {
      setError(errorMessage(cause));
      setHasVault(false);
    });
  }, [store]);

  async function finishAccess(session: ClinicalVaultSession) {
    let persistentStorage = false;
    try {
      persistentStorage = await requestPersistentClinicalStorage();
    } catch {
      persistentStorage = false;
    }
    onAccess({ session, persistentStorage });
  }

  async function createVault() {
    if (!store) return;
    if (passphrase !== confirmation) {
      setError("Passphrase confirmation does not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await finishAccess(await store.create(passphrase));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function unlockVault() {
    if (!store) return;
    setBusy(true);
    setError("");
    try {
      await finishAccess(await store.unlock(passphrase));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup() {
    if (!store) return;
    const inputError = getEncryptedBackupRestoreInputError(Boolean(restoreFile), restorePassphrase);
    if (inputError) {
      setRestoreError(inputError);
      return;
    }
    if (!restoreFile) return;
    setBusy(true);
    setError("");
    setRestoreError("");
    try {
      if (restoreFile.size > 50 * 1024 * 1024) throw new Error("Encrypted vault backups are limited to 50 MB.");
      const backup = JSON.parse(await restoreFile.text()) as ClinicalVaultBackup;
      const replaceExisting = Boolean(hasVault);
      if (replaceExisting && !window.confirm("Replace the existing protected vault with this encrypted backup? Current protected cases will be removed.")) return;
      await finishAccess(await store.restoreEncryptedBackup(backup, restorePassphrase, replaceExisting));
    } catch (cause) {
      setRestoreError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function downloadLegacyBackup() {
    if (!window.confirm("Download a plaintext backup of legacy browser storage? The file may contain identifying clinical information.")) return;
    downloadJson(buildLegacyClinicalStorageBackup(), `nodedent_legacy_plaintext_${new Date().toISOString().slice(0, 10)}.json`);
  }

  function deleteLegacyData() {
    const confirmationText = window.prompt(`Type DELETE LEGACY to remove ${legacyKeys.length} legacy browser-storage item(s). This does not affect the protected vault.`);
    if (confirmationText !== "DELETE LEGACY") return;
    clearLegacyClinicalStorage();
    setLegacyKeys([]);
  }

  async function deleteProtectedVault() {
    if (!store || !hasVault) return;
    const confirmationText = window.prompt("Type DELETE VAULT to permanently remove every protected local case. ClearDent and Dentrix records are not affected.");
    if (confirmationText !== "DELETE VAULT") return;
    setBusy(true);
    setError("");
    try {
      await store.deleteVault();
      setHasVault(false);
      setPassphrase("");
      setConfirmation("");
      setRestoreFile(null);
      setRestorePassphrase("");
      setRestoreError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const secureContextReady = window.isSecureContext && Boolean(globalThis.crypto?.subtle) && Boolean(store);
  const passphraseMismatch = error === "Passphrase confirmation does not match.";
  const vaultPassphraseInvalid = Boolean(error && !passphraseMismatch && /passphrase/i.test(error));
  const restoreFileInvalid = restoreError.startsWith("Choose") || /file|format|json|backup/i.test(restoreError) && !/passphrase/i.test(restoreError);
  const restorePassphraseInvalid = Boolean(restoreError && !restoreFileInvalid);
  const restoreErrorTarget = restoreFileInvalid ? "#encrypted-backup-file" : "#restore-backup-passphrase";

  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-3xl place-items-center">
        <section className="w-full rounded-3xl border border-brand-light-node bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">NodeDent protected clinical workspace</p>
            <button
              type="button"
              aria-pressed={themeMode === "dark"}
              onClick={onToggleTheme}
              className={themeMode === "dark" ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
            >
              <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, themeMode === "dark" ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
              {themeMode === "dark" ? "Dark" : "Light"} mode
            </button>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{hasVault ? "Unlock clinical vault" : "Create clinical vault"}</h1>
          <p className="mt-3 text-sm leading-6 text-brand-slate">
            Use only on a clinic-controlled, encrypted device and browser profile. EMRs such as ClearDent or Dentrix remain the official record. NodeDent does not recover forgotten vault passphrases.
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-slate">
            Review the <a href={PRIVACY_POLICY_HASH} className={cx("font-semibold text-brand-navy underline decoration-brand-light-node underline-offset-4 hover:decoration-brand-navy focus-visible:rounded", semanticInteraction.focus)}>NodeDent privacy policy</a> before creating or unlocking a clinical vault.
          </p>

          {!hasVault ? <SandboxDataWarning className="mt-5" /> : null}

          {!secureContextReady ? (
            <div role="alert" className={cx(semanticStatusSurface.danger, "mt-5 p-4 text-sm leading-6")}>
              Protected clinical storage requires HTTPS, Web Crypto, and IndexedDB. This browser context does not provide all required capabilities.
            </div>
          ) : null}

          {error ? (
            <div id="vault-action-error" role="alert" className={cx(semanticStatusSurface.danger, "mt-5 p-4 text-sm leading-6")}>
              <strong>Vault action needs attention.</strong>{" "}
              {passphraseMismatch ? <><a href="#vault-confirmation" className="font-semibold underline underline-offset-2">Review passphrase confirmation</a>: {error}</> : vaultPassphraseInvalid ? <><a href="#vault-passphrase" className="font-semibold underline underline-offset-2">Review vault passphrase</a>: {error}</> : error}
            </div>
          ) : null}

          {secureContextReady && hasVault !== null ? (
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Vault passphrase</span>
                <input
                  id="vault-passphrase"
                  type="password"
                  autoComplete={hasVault ? "current-password" : "new-password"}
                  value={passphrase}
                  onChange={(event) => {
                    setPassphrase(event.target.value);
                    setError("");
                  }}
                  aria-invalid={vaultPassphraseInvalid || undefined}
                  aria-describedby={[!hasVault ? "vault-passphrase-help" : "", vaultPassphraseInvalid ? "vault-action-error" : ""].filter(Boolean).join(" ") || undefined}
                  className={vaultPassphraseInvalid ? semanticFormControl.invalid : semanticFormControl.default}
                />
              </label>
              {!hasVault ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Confirm passphrase</span>
                  <input
                    id="vault-confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => {
                      setConfirmation(event.target.value);
                      setError("");
                    }}
                    aria-invalid={passphraseMismatch || undefined}
                    aria-describedby={["vault-passphrase-help", passphraseMismatch ? "vault-action-error" : ""].filter(Boolean).join(" ")}
                    className={passphraseMismatch ? semanticFormControl.invalid : semanticFormControl.default}
                  />
                  <span id="vault-passphrase-help" className="mt-1 block text-xs leading-5 text-brand-slate">Use at least 12 characters. The passphrase is never stored and cannot be recovered by NodeDent.</span>
                </label>
              ) : null}
              <button
                type="button"
                disabled={busy || !passphrase}
                onClick={hasVault ? unlockVault : createVault}
                className={semanticActionButton.primaryLarge}
              >
                {busy ? "Working…" : hasVault ? "Unlock vault" : "Create empty protected vault"}
              </button>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-brand-blue-light bg-brand-blue-light/10 p-4">
            <h2 className="text-sm font-bold">Restore encrypted backup</h2>
            <p id="restore-backup-help" className="mt-1 text-xs leading-5 text-brand-slate">Select a `.nodedent` encrypted vault backup and enter the backup's original passphrase below. Restoring never reads prototype `localStorage` records.</p>
            <SandboxDataWarning className="mt-3" />
            <div className="mt-3">
              <FilePickerControl
                id="encrypted-backup-file"
                label="Encrypted backup file"
                buttonLabel="Choose backup file"
                accept=".nodedent,application/json"
                describedBy={["restore-backup-help", restoreFileInvalid ? "restore-backup-error" : ""].filter(Boolean).join(" ")}
                fileName={restoreFile?.name}
                invalid={restoreFileInvalid}
                onFileSelect={(file) => {
                  setRestoreFile(file || null);
                  setRestoreError("");
                }}
              />
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold">Backup passphrase</span>
              <input
                id="restore-backup-passphrase"
                type="password"
                autoComplete="current-password"
                value={restorePassphrase}
                aria-describedby={restorePassphraseInvalid ? "restore-backup-help restore-backup-error" : "restore-backup-help"}
                aria-invalid={restorePassphraseInvalid || undefined}
                onChange={(event) => {
                  setRestorePassphrase(event.target.value);
                  setRestoreError("");
                }}
                className={restorePassphraseInvalid ? semanticFormControl.invalid : semanticFormControl.default}
              />
            </label>
            {restoreError ? <div id="restore-backup-error" role="alert" className={cx(semanticStatusSurface.danger, "mt-3 p-3 text-sm")}><a href={restoreErrorTarget} className="font-semibold underline underline-offset-2">Review encrypted backup input</a>: {restoreError}</div> : null}
            <button type="button" disabled={busy || !store || hasVault === null} onClick={restoreBackup} className={cx(semanticActionButton.warning, "mt-3")}>{busy ? "Working…" : "Restore encrypted backup"}</button>
          </div>

          {legacyKeys.length ? (
            <div className={cx(semanticStatusSurface.attention, "mt-6 p-4")}>
              <h2 className="text-sm font-bold">Legacy prototype storage detected</h2>
              <p className="mt-1 text-xs leading-5">{legacyKeys.length} legacy item(s) remain separate. NodeDent will not parse, copy, migrate, or import them into the clinical vault.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={downloadLegacyBackup} className={semanticActionButton.warningCompact}>Download plaintext legacy backup</button>
                <button type="button" onClick={deleteLegacyData} className={cx(semanticActionButton.destructiveCompact, "sm:ml-auto")}>Delete legacy storage</button>
              </div>
            </div>
          ) : null}

          {hasVault ? (
            <div className={cx(semanticStatusSurface.danger, "mt-6 p-4")}>
              <h2 className="text-sm font-bold">Unrecoverable or retired vault</h2>
              <p className="mt-1 text-xs leading-5">Use only when the protected vault cannot be recovered or clinic retention requires complete local deletion. Export a usable encrypted backup first when possible.</p>
              <button type="button" disabled={busy} onClick={deleteProtectedVault} className={cx(semanticActionButton.destructiveCompact, "mt-3")}>Delete entire protected vault</button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
