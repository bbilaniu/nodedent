import type { EndoCase } from "../types";
import {
  CLINICAL_VAULT_FORMAT_VERSION,
  createClinicalVaultKdf,
  decryptClinicalVaultValue,
  deriveClinicalVaultKey,
  encryptClinicalVaultValue,
  validateClinicalVaultPassphrase,
  type ClinicalVaultEnvelope,
  type ClinicalVaultKdf,
} from "./clinicalVaultCrypto";

export const CLINICAL_VAULT_DATABASE_NAME = "nodedent-clinical-vault-v1";
export const CLINICAL_VAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const CLINICAL_VAULT_DEFAULT_RETENTION_DAYS = 30;

const DATABASE_VERSION = 1;
const METADATA_STORE = "metadata";
const CASE_STORE = "cases";
const VAULT_METADATA_ID = "vault";
const VERIFIER_AAD = "nodedent-clinical-vault-verifier-v1";
const VERIFIER_VALUE = "nodedent-clinical-vault-ready-v1";
const MAX_BACKUP_CASES = 10_000;

export type ClinicalVaultErrorCode =
  | "UNAVAILABLE"
  | "VAULT_EXISTS"
  | "VAULT_NOT_FOUND"
  | "INVALID_PASSPHRASE"
  | "CONFLICT"
  | "CORRUPT_RECORD"
  | "INVALID_BACKUP"
  | "CLOSED"
  | "STORAGE_FAILURE";

export class ClinicalVaultError extends Error {
  constructor(public readonly code: ClinicalVaultErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClinicalVaultError";
  }
}

export type SavedCaseSummary = {
  id: string;
  patientNumber: string;
  tooth: string;
  procedureType: string;
  currentNodeId: string;
  canalCount: number;
  eventCount: number;
  autosavedAt: string;
  revision: number;
  expired: boolean;
};

export type ClinicalCaseSnapshot = {
  formatVersion: typeof CLINICAL_VAULT_FORMAT_VERSION;
  encounterId: string;
  revision: number;
  currentNodeId: string;
  savedAt: string;
  caseData: EndoCase;
  summary: Omit<SavedCaseSummary, "expired">;
};

type VaultMetadata = {
  id: typeof VAULT_METADATA_ID;
  formatVersion: typeof CLINICAL_VAULT_FORMAT_VERSION;
  createdAt: string;
  kdf: ClinicalVaultKdf;
  verifier: ClinicalVaultEnvelope;
  activeEncounterId?: string;
  retentionDays: number;
};

type StoredEncryptedCase = {
  id: string;
  revision: number;
  envelope: ClinicalVaultEnvelope;
};

export type ClinicalVaultBackup = {
  exportKind: "nodedent-encrypted-vault-backup";
  formatVersion: typeof CLINICAL_VAULT_FORMAT_VERSION;
  exportedAt: string;
  metadata: VaultMetadata;
  cases: StoredEncryptedCase[];
};

function caseAad(encounterId: string, revision: number) {
  return `nodedent-clinical-case:${encounterId}:revision:${revision}`;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
  });
}

function openDatabase(factory: IDBFactory, databaseName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(METADATA_STORE)) database.createObjectStore(METADATA_STORE, { keyPath: "id" });
      if (!database.objectStoreNames.contains(CASE_STORE)) database.createObjectStore(CASE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error("Could not open the clinical vault database."));
    request.onblocked = () => reject(new Error("Clinical vault database upgrade is blocked by another tab."));
  });
}

function asStorageError(error: unknown, message: string) {
  if (error instanceof ClinicalVaultError) return error;
  return new ClinicalVaultError("STORAGE_FAILURE", message, { cause: error });
}

function assertVaultMetadata(value: unknown): asserts value is VaultMetadata {
  const metadata = value as Partial<VaultMetadata> | null;
  if (
    !metadata ||
    metadata.id !== VAULT_METADATA_ID ||
    metadata.formatVersion !== CLINICAL_VAULT_FORMAT_VERSION ||
    !metadata.kdf ||
    !metadata.verifier ||
    typeof metadata.createdAt !== "string" ||
    !Number.isFinite(new Date(metadata.createdAt).getTime()) ||
    !Number.isInteger(metadata.retentionDays) ||
    Number(metadata.retentionDays) < 1 ||
    Number(metadata.retentionDays) > 3650 ||
    (metadata.activeEncounterId !== undefined && (typeof metadata.activeEncounterId !== "string" || !metadata.activeEncounterId))
  ) {
    throw new ClinicalVaultError("VAULT_NOT_FOUND", "Clinical vault metadata is missing or unsupported.");
  }
}

function assertEncryptedCase(value: unknown): asserts value is StoredEncryptedCase {
  const record = value as Partial<StoredEncryptedCase> | null;
  if (!record || typeof record.id !== "string" || !record.id || record.id.length > 128 || !Number.isInteger(record.revision) || Number(record.revision) < 1 || !record.envelope) {
    throw new ClinicalVaultError("CORRUPT_RECORD", "A protected case record is malformed.");
  }
}

function assertClinicalCaseSnapshot(value: unknown, record: StoredEncryptedCase): asserts value is ClinicalCaseSnapshot {
  const payload = value as Partial<ClinicalCaseSnapshot> | null;
  const caseData = payload?.caseData as Partial<EndoCase> | undefined;
  const summary = payload?.summary as Partial<SavedCaseSummary> | undefined;
  if (
    !payload ||
    payload.formatVersion !== CLINICAL_VAULT_FORMAT_VERSION ||
    payload.encounterId !== record.id ||
    payload.revision !== record.revision ||
    typeof payload.currentNodeId !== "string" ||
    !payload.currentNodeId ||
    typeof payload.savedAt !== "string" ||
    !Number.isFinite(new Date(payload.savedAt).getTime()) ||
    !caseData ||
    caseData.encounterId !== record.id ||
    typeof caseData.patientNumber !== "string" ||
    typeof caseData.tooth !== "string" ||
    typeof caseData.procedureType !== "string" ||
    !Array.isArray(caseData.canals) ||
    !Array.isArray(caseData.globalEvents) ||
    !summary ||
    summary.id !== record.id ||
    summary.revision !== record.revision ||
    typeof summary.patientNumber !== "string" ||
    typeof summary.tooth !== "string" ||
    typeof summary.procedureType !== "string" ||
    typeof summary.autosavedAt !== "string"
  ) {
    throw new ClinicalVaultError("CORRUPT_RECORD", "A protected case payload is malformed or inconsistent.");
  }
}

function buildSummary(caseData: EndoCase, currentNodeId: string, savedAt: string, revision: number): Omit<SavedCaseSummary, "expired"> {
  return {
    id: caseData.encounterId,
    patientNumber: caseData.patientNumber || "No chart #",
    tooth: caseData.tooth || "Tooth ___",
    procedureType: caseData.procedureType,
    currentNodeId,
    canalCount: caseData.canals?.length || 0,
    eventCount: caseData.globalEvents?.length || 0,
    autosavedAt: savedAt,
    revision,
  };
}

function isExpired(savedAt: string, retentionDays: number, now = Date.now()) {
  const timestamp = new Date(savedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return now - timestamp > retentionDays * 24 * 60 * 60 * 1000;
}

export class ClinicalVaultSession {
  private key: CryptoKey | null;

  constructor(
    private readonly database: IDBDatabase,
    key: CryptoKey,
    private metadata: VaultMetadata
  ) {
    this.key = key;
  }

  private requireKey() {
    if (!this.key) throw new ClinicalVaultError("CLOSED", "The clinical vault is locked.");
    return this.key;
  }

  get retentionDays() {
    return this.metadata.retentionDays || CLINICAL_VAULT_DEFAULT_RETENTION_DAYS;
  }

  async loadActiveCase() {
    const encounterId = this.metadata.activeEncounterId;
    return encounterId ? this.loadCase(encounterId) : null;
  }

  async loadCase(encounterId: string) {
    try {
      const transaction = this.database.transaction(CASE_STORE, "readonly");
      const record = await requestResult(transaction.objectStore(CASE_STORE).get(encounterId));
      await transactionComplete(transaction);
      if (!record) return null;
      assertEncryptedCase(record);
      const payload = await decryptClinicalVaultValue<ClinicalCaseSnapshot>(
        this.requireKey(),
        record.envelope,
        caseAad(record.id, record.revision)
      );
      assertClinicalCaseSnapshot(payload, record);
      return payload;
    } catch (error) {
      if (error instanceof ClinicalVaultError) throw error;
      if (error instanceof DOMException && error.name === "OperationError") {
        throw new ClinicalVaultError("CORRUPT_RECORD", "The protected case could not be authenticated or decrypted.", { cause: error });
      }
      throw asStorageError(error, "Could not load the protected case.");
    }
  }

  async listCases(): Promise<SavedCaseSummary[]> {
    try {
      const transaction = this.database.transaction(CASE_STORE, "readonly");
      const records = await requestResult(transaction.objectStore(CASE_STORE).getAll());
      await transactionComplete(transaction);
      const summaries = await Promise.all(records.map(async (record) => {
        assertEncryptedCase(record);
        const payload = await decryptClinicalVaultValue<ClinicalCaseSnapshot>(
          this.requireKey(),
          record.envelope,
          caseAad(record.id, record.revision)
        );
        assertClinicalCaseSnapshot(payload, record);
        return {
          ...payload.summary,
          expired: isExpired(payload.summary.autosavedAt, this.retentionDays),
        };
      }));
      return summaries.sort((left, right) => right.autosavedAt.localeCompare(left.autosavedAt));
    } catch (error) {
      if (error instanceof ClinicalVaultError) throw error;
      throw asStorageError(error, "Could not list protected cases.");
    }
  }

  async saveCase(caseData: EndoCase, currentNodeId: string, expectedRevision: number) {
    if (!caseData.encounterId || caseData.encounterId.length > 128 || !currentNodeId || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new ClinicalVaultError("CORRUPT_RECORD", "The clinical draft identity, node, or revision is invalid.");
    }
    const savedAt = new Date().toISOString();
    const revision = expectedRevision + 1;
    const normalizedCaseData: EndoCase = {
      ...caseData,
      autosavedAt: savedAt,
      revision,
    };
    const payload: ClinicalCaseSnapshot = {
      formatVersion: CLINICAL_VAULT_FORMAT_VERSION,
      encounterId: caseData.encounterId,
      revision,
      currentNodeId,
      savedAt,
      caseData: normalizedCaseData,
      summary: buildSummary(normalizedCaseData, currentNodeId, savedAt, revision),
    };
    const storedRecord: StoredEncryptedCase = {
      id: caseData.encounterId,
      revision,
      envelope: await encryptClinicalVaultValue(
        this.requireKey(),
        payload,
        caseAad(caseData.encounterId, revision)
      ),
    };

    return new Promise<ClinicalCaseSnapshot>((resolve, reject) => {
      let conflict: ClinicalVaultError | null = null;
      const transaction = this.database.transaction([CASE_STORE, METADATA_STORE], "readwrite");
      const caseStore = transaction.objectStore(CASE_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const getRequest = caseStore.get(caseData.encounterId);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as StoredEncryptedCase | undefined;
        const existingRevision = existing?.revision || 0;
        if (existingRevision !== expectedRevision) {
          conflict = new ClinicalVaultError(
            "CONFLICT",
            "This case changed in another tab. Lock this tab and reopen the latest saved version."
          );
          transaction.abort();
          return;
        }
        caseStore.put(storedRecord);
        this.metadata = { ...this.metadata, activeEncounterId: caseData.encounterId };
        metadataStore.put(this.metadata);
      };
      getRequest.onerror = () => reject(asStorageError(getRequest.error, "Could not inspect the existing protected case."));
      transaction.oncomplete = () => resolve(payload);
      transaction.onerror = () => {
        if (!conflict) reject(asStorageError(transaction.error, "Could not save the protected case."));
      };
      transaction.onabort = () => reject(conflict || asStorageError(transaction.error, "Protected case save was interrupted."));
    });
  }

  async deleteCase(encounterId: string) {
    try {
      const transaction = this.database.transaction([CASE_STORE, METADATA_STORE], "readwrite");
      transaction.objectStore(CASE_STORE).delete(encounterId);
      if (this.metadata.activeEncounterId === encounterId) {
        this.metadata = { ...this.metadata, activeEncounterId: undefined };
        transaction.objectStore(METADATA_STORE).put(this.metadata);
      }
      await transactionComplete(transaction);
    } catch (error) {
      throw asStorageError(error, "Could not delete the protected case.");
    }
  }

  async clearCases() {
    try {
      const transaction = this.database.transaction([CASE_STORE, METADATA_STORE], "readwrite");
      transaction.objectStore(CASE_STORE).clear();
      this.metadata = { ...this.metadata, activeEncounterId: undefined };
      transaction.objectStore(METADATA_STORE).put(this.metadata);
      await transactionComplete(transaction);
    } catch (error) {
      throw asStorageError(error, "Could not clear protected cases.");
    }
  }

  async exportEncryptedBackup(): Promise<ClinicalVaultBackup> {
    try {
      const transaction = this.database.transaction(CASE_STORE, "readonly");
      const records = await requestResult(transaction.objectStore(CASE_STORE).getAll());
      await transactionComplete(transaction);
      records.forEach(assertEncryptedCase);
      return {
        exportKind: "nodedent-encrypted-vault-backup",
        formatVersion: CLINICAL_VAULT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        metadata: structuredClone(this.metadata),
        cases: structuredClone(records as StoredEncryptedCase[]),
      };
    } catch (error) {
      throw asStorageError(error, "Could not create the encrypted vault backup.");
    }
  }

  close() {
    this.key = null;
    this.database.close();
  }
}

export class ClinicalVaultStore {
  constructor(
    private readonly factory: IDBFactory = globalThis.indexedDB,
    private readonly databaseName = CLINICAL_VAULT_DATABASE_NAME
  ) {
    if (!factory) throw new ClinicalVaultError("UNAVAILABLE", "IndexedDB is not available in this browser.");
  }

  async hasVault() {
    const database = await openDatabase(this.factory, this.databaseName);
    try {
      const transaction = database.transaction(METADATA_STORE, "readonly");
      const metadata = await requestResult(transaction.objectStore(METADATA_STORE).get(VAULT_METADATA_ID));
      await transactionComplete(transaction);
      return Boolean(metadata);
    } finally {
      database.close();
    }
  }

  async deleteVault() {
    return new Promise<void>((resolve, reject) => {
      const request = this.factory.deleteDatabase(this.databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(asStorageError(request.error, "Could not delete the protected clinical vault."));
      request.onblocked = () => reject(new ClinicalVaultError("STORAGE_FAILURE", "Vault deletion is blocked by another open NodeDent tab. Lock or close every other tab and try again."));
    });
  }

  async create(passphrase: string) {
    validateClinicalVaultPassphrase(passphrase);
    const database = await openDatabase(this.factory, this.databaseName);
    try {
      const readTransaction = database.transaction(METADATA_STORE, "readonly");
      const existing = await requestResult(readTransaction.objectStore(METADATA_STORE).get(VAULT_METADATA_ID));
      await transactionComplete(readTransaction);
      if (existing) throw new ClinicalVaultError("VAULT_EXISTS", "A clinical vault already exists in this browser profile.");

      const kdf = createClinicalVaultKdf();
      const key = await deriveClinicalVaultKey(passphrase, kdf);
      const metadata: VaultMetadata = {
        id: VAULT_METADATA_ID,
        formatVersion: CLINICAL_VAULT_FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        kdf,
        verifier: await encryptClinicalVaultValue(key, VERIFIER_VALUE, VERIFIER_AAD),
        retentionDays: CLINICAL_VAULT_DEFAULT_RETENTION_DAYS,
      };
      const writeTransaction = database.transaction(METADATA_STORE, "readwrite");
      writeTransaction.objectStore(METADATA_STORE).put(metadata);
      await transactionComplete(writeTransaction);
      return new ClinicalVaultSession(database, key, metadata);
    } catch (error) {
      database.close();
      throw asStorageError(error, "Could not create the clinical vault.");
    }
  }

  async unlock(passphrase: string) {
    validateClinicalVaultPassphrase(passphrase);
    const database = await openDatabase(this.factory, this.databaseName);
    try {
      const transaction = database.transaction(METADATA_STORE, "readonly");
      const value = await requestResult(transaction.objectStore(METADATA_STORE).get(VAULT_METADATA_ID));
      await transactionComplete(transaction);
      assertVaultMetadata(value);
      const key = await deriveClinicalVaultKey(passphrase, value.kdf);
      try {
        const verifier = await decryptClinicalVaultValue<string>(key, value.verifier, VERIFIER_AAD);
        if (verifier !== VERIFIER_VALUE) throw new Error("Vault verifier did not match.");
      } catch (error) {
        throw new ClinicalVaultError("INVALID_PASSPHRASE", "The unlock passphrase is incorrect or the vault is damaged.", { cause: error });
      }
      return new ClinicalVaultSession(database, key, value);
    } catch (error) {
      database.close();
      throw asStorageError(error, "Could not unlock the clinical vault.");
    }
  }

  async restoreEncryptedBackup(backup: ClinicalVaultBackup, passphrase: string, replaceExisting = false) {
    validateClinicalVaultPassphrase(passphrase);
    if (
      backup?.exportKind !== "nodedent-encrypted-vault-backup" ||
      backup.formatVersion !== CLINICAL_VAULT_FORMAT_VERSION ||
      !backup.metadata ||
      !Array.isArray(backup.cases) ||
      backup.cases.length > MAX_BACKUP_CASES
    ) {
      throw new ClinicalVaultError("INVALID_BACKUP", "This is not a supported NodeDent encrypted vault backup.");
    }
    assertVaultMetadata(backup.metadata);
    backup.cases.forEach(assertEncryptedCase);

    const key = await deriveClinicalVaultKey(passphrase, backup.metadata.kdf);
    try {
      const verifier = await decryptClinicalVaultValue<string>(key, backup.metadata.verifier, VERIFIER_AAD);
      if (verifier !== VERIFIER_VALUE) throw new Error("Vault verifier did not match.");
    } catch (error) {
      throw new ClinicalVaultError("INVALID_PASSPHRASE", "The backup passphrase is incorrect or the backup is damaged.", { cause: error });
    }

    try {
      const encounterIds = new Set<string>();
      for (const record of backup.cases) {
        if (encounterIds.has(record.id)) throw new Error("Duplicate encounter identifier.");
        encounterIds.add(record.id);
        const payload = await decryptClinicalVaultValue<ClinicalCaseSnapshot>(key, record.envelope, caseAad(record.id, record.revision));
        assertClinicalCaseSnapshot(payload, record);
      }
      if (backup.metadata.activeEncounterId && !encounterIds.has(backup.metadata.activeEncounterId)) {
        throw new Error("Active encounter does not exist in the backup.");
      }
    } catch (error) {
      throw new ClinicalVaultError("INVALID_BACKUP", "An encrypted case in this backup is damaged or inconsistent.", { cause: error });
    }

    const database = await openDatabase(this.factory, this.databaseName);
    try {
      const readTransaction = database.transaction(METADATA_STORE, "readonly");
      const existing = await requestResult(readTransaction.objectStore(METADATA_STORE).get(VAULT_METADATA_ID));
      await transactionComplete(readTransaction);
      if (existing && !replaceExisting) {
        throw new ClinicalVaultError("VAULT_EXISTS", "A clinical vault already exists. Confirm replacement before restoring a backup.");
      }

      const writeTransaction = database.transaction([METADATA_STORE, CASE_STORE], "readwrite");
      writeTransaction.objectStore(METADATA_STORE).clear();
      writeTransaction.objectStore(CASE_STORE).clear();
      writeTransaction.objectStore(METADATA_STORE).put(backup.metadata);
      backup.cases.forEach((record) => writeTransaction.objectStore(CASE_STORE).put(record));
      await transactionComplete(writeTransaction);
      return new ClinicalVaultSession(database, key, structuredClone(backup.metadata));
    } catch (error) {
      database.close();
      throw asStorageError(error, "Could not restore the encrypted vault backup.");
    }
  }
}

export async function requestPersistentClinicalStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
