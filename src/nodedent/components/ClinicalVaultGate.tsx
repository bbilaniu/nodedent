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

export function ClinicalVaultGate({ onAccess }: { onAccess: (access: ClinicalVaultAccess) => void }) {
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
    if (!store || !restoreFile) return;
    setBusy(true);
    setError("");
    try {
      if (restoreFile.size > 50 * 1024 * 1024) throw new Error("Encrypted vault backups are limited to 50 MB.");
      const backup = JSON.parse(await restoreFile.text()) as ClinicalVaultBackup;
      const replaceExisting = Boolean(hasVault);
      if (replaceExisting && !window.confirm("Replace the existing protected vault with this encrypted backup? Current protected cases will be removed.")) return;
      await finishAccess(await store.restoreEncryptedBackup(backup, passphrase, replaceExisting));
    } catch (cause) {
      setError(errorMessage(cause));
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
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const secureContextReady = window.isSecureContext && Boolean(globalThis.crypto?.subtle) && Boolean(store);

  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-3xl place-items-center">
        <section className="w-full rounded-3xl border border-brand-light-node bg-white p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">NodeDent protected clinical workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{hasVault ? "Unlock clinical vault" : "Create clinical vault"}</h1>
          <p className="mt-3 text-sm leading-6 text-brand-slate">
            Use only on a clinic-controlled, encrypted device and browser profile. ClearDent or Dentrix remains the official record. NodeDent does not recover forgotten vault passphrases.
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-slate">
            Review the <a href={PRIVACY_POLICY_HASH} className="font-semibold text-brand-navy underline decoration-brand-light-node underline-offset-4 hover:decoration-brand-navy focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint">NodeDent privacy policy</a> before creating or unlocking a clinical vault.
          </p>

          {!secureContextReady ? (
            <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900">
              Protected clinical storage requires HTTPS, Web Crypto, and IndexedDB. This browser context does not provide all required capabilities.
            </div>
          ) : null}

          {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div> : null}

          {secureContextReady && hasVault !== null ? (
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Vault passphrase</span>
                <input
                  type="password"
                  autoComplete={hasVault ? "current-password" : "new-password"}
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  className="w-full rounded-xl border border-brand-light-node px-3 py-2 outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
                />
              </label>
              {!hasVault ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Confirm passphrase</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="w-full rounded-xl border border-brand-light-node px-3 py-2 outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
                  />
                  <span className="mt-1 block text-xs leading-5 text-brand-slate">Use at least 12 characters. The passphrase is never stored and cannot be recovered by NodeDent.</span>
                </label>
              ) : null}
              <button
                type="button"
                disabled={busy || !passphrase}
                onClick={hasVault ? unlockVault : createVault}
                className="rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Working…" : hasVault ? "Unlock vault" : "Create empty protected vault"}
              </button>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-brand-blue-light bg-brand-blue-light/10 p-4">
            <h2 className="text-sm font-bold">Restore encrypted backup</h2>
            <p className="mt-1 text-xs leading-5 text-brand-slate">Select a `.nodedent` encrypted vault backup and enter its passphrase above. Restoring never reads prototype `localStorage` records.</p>
            <input type="file" accept=".nodedent,application/json" onChange={(event) => setRestoreFile(event.target.files?.[0] || null)} className="mt-3 block w-full text-sm" />
            <button type="button" disabled={busy || !restoreFile || !passphrase} onClick={restoreBackup} className="mt-3 rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">Restore encrypted backup</button>
          </div>

          {legacyKeys.length ? (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <h2 className="text-sm font-bold">Legacy prototype storage detected</h2>
              <p className="mt-1 text-xs leading-5">{legacyKeys.length} legacy item(s) remain separate. NodeDent will not parse, copy, migrate, or import them into the clinical vault.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={downloadLegacyBackup} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold">Download plaintext legacy backup</button>
                <button type="button" onClick={deleteLegacyData} className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800">Delete legacy storage</button>
              </div>
            </div>
          ) : null}

          {hasVault ? (
            <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
              <h2 className="text-sm font-bold">Unrecoverable or retired vault</h2>
              <p className="mt-1 text-xs leading-5">Use only when the protected vault cannot be recovered or clinic retention requires complete local deletion. Export a usable encrypted backup first when possible.</p>
              <button type="button" disabled={busy} onClick={deleteProtectedVault} className="mt-3 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-900 disabled:opacity-50">Delete entire protected vault</button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
