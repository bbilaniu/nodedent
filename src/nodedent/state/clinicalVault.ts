import type { EndoCase } from "../types";
import { EndoCaseSchema } from "../schemas/EndoCase.schema";
import { isMeaningfulCase } from "./caseEntry";
import {
  classifyBackupConflict,
  describeClinicalSnapshotDifferences,
  digestClinicalSnapshotContent,
  summarizeClinicalSnapshot,
  type BackupConflictClassification,
  type ClinicalSnapshotComparison,
} from "./clinicalVaultConflict";
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

const DATABASE_VERSION = 2;
const METADATA_STORE = "metadata";
const CASE_STORE = "cases";
const RECOVERY_STORE = "recoveryHistory";
const VAULT_METADATA_ID = "vault";
const VERIFIER_AAD = "nodedent-clinical-vault-verifier-v1";
const VERIFIER_VALUE = "nodedent-clinical-vault-ready-v1";
const MAX_BACKUP_CASES = 10_000;
const MAX_BACKUP_RECOVERY_RECORDS = 20_000;
const CURRENT_BACKUP_FORMAT_VERSION = 2;

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
  meaningful?: boolean;
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
  recovery?: RecoveryImportProvenance;
};

export type RecoveryImportProvenance = {
  importedAt: string;
  backupExportedAt: string;
  sourceRevision: number;
  replacedRevision: number;
  sourceContentDigest: string;
  replacedContentDigest: string;
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

type RecoveryHistoryEntry = {
  id: string;
  encounterId: string;
  archivedAt: string;
  reason: "backup-conflict-replacement" | "recovery-history-restoration";
  provenance: RecoveryImportProvenance;
  snapshot: ClinicalCaseSnapshot;
};

type StoredEncryptedRecovery = {
  id: string;
  encounterId: string;
  envelope: ClinicalVaultEnvelope;
};

export type ClinicalVaultBackup = {
  exportKind: "nodedent-encrypted-vault-backup";
  formatVersion: 1 | typeof CURRENT_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  metadata: VaultMetadata;
  cases: StoredEncryptedCase[];
  recoveryHistory?: StoredEncryptedRecovery[];
};

export type EncryptedBackupConflictPreview = {
  encounterId: string;
  classification: Exclude<BackupConflictClassification, "identical">;
  activeEncounter: boolean;
  localDigest: string;
  incomingDigest: string;
  local: ClinicalSnapshotComparison;
  incoming: ClinicalSnapshotComparison;
  differences: string[];
};

export type EncryptedBackupImportPreview = {
  formatVersion: 1 | typeof CURRENT_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  totalCases: number;
  additions: number;
  existingEncounterIds: number;
  sameRevision: number;
  incomingNewer: number;
  incomingOlder: number;
  identicalContent: number;
  conflicts: EncryptedBackupConflictPreview[];
};

export type EncryptedBackupImportResult = EncryptedBackupImportPreview & {
  imported: number;
  skipped: number;
  failed: number;
};

export type BackupConflictResolution = {
  encounterId: string;
  action: "keepLocal" | "replaceWithBackup" | "defer";
  expectedLocalRevision: number;
  localDigest: string;
  incomingDigest: string;
};

export type EncryptedBackupResolutionResult = {
  imported: number;
  replaced: number;
  archived: number;
  keptLocal: number;
  deferred: number;
  identicalSkipped: number;
  failed: number;
};

export type RecoveryHistorySummary = {
  id: string;
  encounterId: string;
  archivedAt: string;
  revision: number;
  patientNumber: string;
  tooth: string;
  procedureType: string;
  reason: RecoveryHistoryEntry["reason"];
};

function caseAad(encounterId: string, revision: number) {
  return `nodedent-clinical-case:${encounterId}:revision:${revision}`;
}

function recoveryAad(id: string) {
  return `nodedent-clinical-recovery:${id}`;
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
      if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
        const recoveryStore = database.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
        recoveryStore.createIndex("encounterId", "encounterId", { unique: false });
      }
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

function assertEncryptedRecovery(value: unknown): asserts value is StoredEncryptedRecovery {
  const record = value as Partial<StoredEncryptedRecovery> | null;
  if (
    !record ||
    typeof record.id !== "string" ||
    !record.id ||
    record.id.length > 128 ||
    typeof record.encounterId !== "string" ||
    !record.encounterId ||
    record.encounterId.length > 128 ||
    !record.envelope
  ) {
    throw new ClinicalVaultError("CORRUPT_RECORD", "A protected recovery-history record is malformed.");
  }
}

function isRecoveryImportProvenance(value: unknown): value is RecoveryImportProvenance {
  const provenance = value as Partial<RecoveryImportProvenance> | null;
  return Boolean(
    provenance &&
    typeof provenance.importedAt === "string" &&
    Number.isFinite(new Date(provenance.importedAt).getTime()) &&
    typeof provenance.backupExportedAt === "string" &&
    Number.isFinite(new Date(provenance.backupExportedAt).getTime()) &&
    Number.isInteger(provenance.sourceRevision) &&
    Number(provenance.sourceRevision) >= 1 &&
    Number.isInteger(provenance.replacedRevision) &&
    Number(provenance.replacedRevision) >= 1 &&
    typeof provenance.sourceContentDigest === "string" &&
    /^[a-f0-9]{64}$/u.test(provenance.sourceContentDigest) &&
    typeof provenance.replacedContentDigest === "string" &&
    /^[a-f0-9]{64}$/u.test(provenance.replacedContentDigest)
  );
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
    !EndoCaseSchema.safeParse(caseData).success ||
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
    typeof summary.autosavedAt !== "string" ||
    (payload.recovery !== undefined && !isRecoveryImportProvenance(payload.recovery))
  ) {
    throw new ClinicalVaultError("CORRUPT_RECORD", "A protected case payload is malformed or inconsistent.");
  }
}


function assertRecoveryHistoryEntry(value: unknown, record: StoredEncryptedRecovery): asserts value is RecoveryHistoryEntry {
  const entry = value as Partial<RecoveryHistoryEntry> | null;
  const provenance = entry?.provenance as Partial<RecoveryImportProvenance> | undefined;
  if (
    !entry ||
    entry.id !== record.id ||
    entry.encounterId !== record.encounterId ||
    !["backup-conflict-replacement", "recovery-history-restoration"].includes(entry.reason || "") ||
    typeof entry.archivedAt !== "string" ||
    !Number.isFinite(new Date(entry.archivedAt).getTime()) ||
    !isRecoveryImportProvenance(provenance) ||
    !entry.snapshot
  ) {
    throw new ClinicalVaultError("CORRUPT_RECORD", "A protected recovery-history payload is malformed.");
  }
  assertClinicalCaseSnapshot(entry.snapshot, {
    id: entry.encounterId,
    revision: entry.snapshot.revision,
    envelope: record.envelope,
  });
}

async function decryptAndValidateClinicalVaultBackup(backup: ClinicalVaultBackup, passphrase: string) {
  validateClinicalVaultPassphrase(passphrase);
  if (
    backup?.exportKind !== "nodedent-encrypted-vault-backup" ||
    ![1, CURRENT_BACKUP_FORMAT_VERSION].includes(backup.formatVersion) ||
    !backup.metadata ||
    !Array.isArray(backup.cases) ||
    backup.cases.length > MAX_BACKUP_CASES ||
    typeof backup.exportedAt !== "string" ||
    !Number.isFinite(new Date(backup.exportedAt).getTime()) ||
    (backup.formatVersion === 1 && backup.recoveryHistory !== undefined) ||
    (backup.formatVersion === CURRENT_BACKUP_FORMAT_VERSION && !Array.isArray(backup.recoveryHistory)) ||
    (backup.recoveryHistory?.length || 0) > MAX_BACKUP_RECOVERY_RECORDS
  ) {
    throw new ClinicalVaultError("INVALID_BACKUP", "This is not a supported NodeDent encrypted vault backup.");
  }
  assertVaultMetadata(backup.metadata);
  backup.cases.forEach(assertEncryptedCase);
  (backup.recoveryHistory || []).forEach(assertEncryptedRecovery);

  const key = await deriveClinicalVaultKey(passphrase, backup.metadata.kdf);
  try {
    const verifier = await decryptClinicalVaultValue<string>(key, backup.metadata.verifier, VERIFIER_AAD);
    if (verifier !== VERIFIER_VALUE) throw new Error("Vault verifier did not match.");
  } catch (error) {
    throw new ClinicalVaultError("INVALID_PASSPHRASE", "The backup passphrase is incorrect or the backup is damaged.", { cause: error });
  }

  try {
    const encounterIds = new Set<string>();
    const snapshots: ClinicalCaseSnapshot[] = [];
    for (const record of backup.cases) {
      if (encounterIds.has(record.id)) throw new Error("Duplicate encounter identifier.");
      encounterIds.add(record.id);
      const payload = await decryptClinicalVaultValue<ClinicalCaseSnapshot>(key, record.envelope, caseAad(record.id, record.revision));
      assertClinicalCaseSnapshot(payload, record);
      snapshots.push(payload);
    }
    if (backup.metadata.activeEncounterId && !encounterIds.has(backup.metadata.activeEncounterId)) {
      throw new Error("Active encounter does not exist in the backup.");
    }
    const recoveryEntries: RecoveryHistoryEntry[] = [];
    const recoveryIds = new Set<string>();
    for (const record of backup.recoveryHistory || []) {
      if (recoveryIds.has(record.id)) throw new Error("Duplicate recovery-history identifier.");
      recoveryIds.add(record.id);
      const entry = await decryptClinicalVaultValue<RecoveryHistoryEntry>(key, record.envelope, recoveryAad(record.id));
      assertRecoveryHistoryEntry(entry, record);
      recoveryEntries.push(entry);
    }
    return { key, snapshots, recoveryEntries };
  } catch (error) {
    throw new ClinicalVaultError("INVALID_BACKUP", "An encrypted case in this backup is damaged or inconsistent.", { cause: error });
  }
}

async function buildEncryptedBackupImportPreview(
  formatVersion: ClinicalVaultBackup["formatVersion"],
  exportedAt: string,
  snapshots: ClinicalCaseSnapshot[],
  localSnapshots: Map<string, ClinicalCaseSnapshot>,
  activeEncounterId?: string
): Promise<EncryptedBackupImportPreview> {
  const preview: EncryptedBackupImportPreview = {
    formatVersion,
    exportedAt,
    totalCases: snapshots.length,
    additions: 0,
    existingEncounterIds: 0,
    sameRevision: 0,
    incomingNewer: 0,
    incomingOlder: 0,
    identicalContent: 0,
    conflicts: [],
  };
  for (const snapshot of snapshots) {
    const local = localSnapshots.get(snapshot.encounterId);
    if (!local) preview.additions += 1;
    else {
      preview.existingEncounterIds += 1;
      if (snapshot.revision === local.revision) preview.sameRevision += 1;
      else if (snapshot.revision > local.revision) preview.incomingNewer += 1;
      else preview.incomingOlder += 1;
      const [localDigest, incomingDigest] = await Promise.all([
        digestClinicalSnapshotContent(local),
        digestClinicalSnapshotContent(snapshot),
      ]);
      const classification = classifyBackupConflict(local.revision, snapshot.revision, localDigest === incomingDigest);
      if (classification === "identical") preview.identicalContent += 1;
      else preview.conflicts.push({
        encounterId: snapshot.encounterId,
        classification,
        activeEncounter: activeEncounterId === snapshot.encounterId,
        localDigest,
        incomingDigest,
        local: summarizeClinicalSnapshot(local),
        incoming: summarizeClinicalSnapshot(snapshot),
        differences: describeClinicalSnapshotDifferences(local, snapshot),
      });
    }
  }
  return preview;
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
    meaningful: isMeaningfulCase(caseData, currentNodeId),
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
    private metadata: VaultMetadata,
    private readonly recoveryIdFactory: () => string = () => globalThis.crypto.randomUUID()
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

  async detachActiveEncounterForRecovery() {
    try {
      const transaction = this.database.transaction(METADATA_STORE, "readwrite");
      this.metadata = { ...this.metadata, activeEncounterId: undefined };
      transaction.objectStore(METADATA_STORE).put(this.metadata);
      await transactionComplete(transaction);
    } catch (error) {
      throw asStorageError(error, "Could not close the active encounter for recovery.");
    }
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
          meaningful: isMeaningfulCase(payload.caseData, payload.currentNodeId),
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
      const transaction = this.database.transaction([CASE_STORE, METADATA_STORE, RECOVERY_STORE], "readwrite");
      transaction.objectStore(CASE_STORE).delete(encounterId);
      const recoveryIndex = transaction.objectStore(RECOVERY_STORE).index("encounterId");
      const recoveryRequest = recoveryIndex.openKeyCursor(encounterId);
      recoveryRequest.onsuccess = () => {
        const cursor = recoveryRequest.result;
        if (!cursor) return;
        transaction.objectStore(RECOVERY_STORE).delete(cursor.primaryKey);
        cursor.continue();
      };
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
      const transaction = this.database.transaction([CASE_STORE, METADATA_STORE, RECOVERY_STORE], "readwrite");
      transaction.objectStore(CASE_STORE).clear();
      transaction.objectStore(RECOVERY_STORE).clear();
      this.metadata = { ...this.metadata, activeEncounterId: undefined };
      transaction.objectStore(METADATA_STORE).put(this.metadata);
      await transactionComplete(transaction);
    } catch (error) {
      throw asStorageError(error, "Could not clear protected cases.");
    }
  }

  async exportEncryptedBackup(): Promise<ClinicalVaultBackup> {
    try {
      const transaction = this.database.transaction([CASE_STORE, RECOVERY_STORE], "readonly");
      const records = await requestResult(transaction.objectStore(CASE_STORE).getAll());
      const recoveryRecords = await requestResult(transaction.objectStore(RECOVERY_STORE).getAll());
      await transactionComplete(transaction);
      records.forEach(assertEncryptedCase);
      recoveryRecords.forEach(assertEncryptedRecovery);
      return {
        exportKind: "nodedent-encrypted-vault-backup",
        formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        metadata: structuredClone(this.metadata),
        cases: structuredClone(records as StoredEncryptedCase[]),
        recoveryHistory: structuredClone(recoveryRecords as StoredEncryptedRecovery[]),
      };
    } catch (error) {
      throw asStorageError(error, "Could not create the encrypted vault backup.");
    }
  }

  private async getStoredCaseSnapshots() {
    const transaction = this.database.transaction(CASE_STORE, "readonly");
    const records = await requestResult(transaction.objectStore(CASE_STORE).getAll()) as StoredEncryptedCase[];
    await transactionComplete(transaction);
    records.forEach(assertEncryptedCase);
    const snapshots = await Promise.all(records.map(async (record) => {
      const snapshot = await decryptClinicalVaultValue<ClinicalCaseSnapshot>(this.requireKey(), record.envelope, caseAad(record.id, record.revision));
      assertClinicalCaseSnapshot(snapshot, record);
      return snapshot;
    }));
    return new Map(snapshots.map((snapshot) => [snapshot.encounterId, snapshot]));
  }

  async listRecoveryHistory(encounterId?: string): Promise<RecoveryHistorySummary[]> {
    try {
      const transaction = this.database.transaction(RECOVERY_STORE, "readonly");
      const store = transaction.objectStore(RECOVERY_STORE);
      const records = await requestResult(
        encounterId ? store.index("encounterId").getAll(encounterId) : store.getAll()
      ) as StoredEncryptedRecovery[];
      await transactionComplete(transaction);
      const entries = await Promise.all(records.map(async (record) => {
        assertEncryptedRecovery(record);
        const entry = await decryptClinicalVaultValue<RecoveryHistoryEntry>(this.requireKey(), record.envelope, recoveryAad(record.id));
        assertRecoveryHistoryEntry(entry, record);
        return entry;
      }));
      return entries.map((entry) => ({
        id: entry.id,
        encounterId: entry.encounterId,
        archivedAt: entry.archivedAt,
        revision: entry.snapshot.revision,
        patientNumber: entry.snapshot.caseData.patientNumber,
        tooth: entry.snapshot.caseData.tooth,
        procedureType: entry.snapshot.caseData.procedureType,
        reason: entry.reason,
      })).sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));
    } catch (error) {
      if (error instanceof ClinicalVaultError) throw error;
      throw asStorageError(error, "Could not read protected recovery history.");
    }
  }

  async loadRecoveryHistorySnapshot(id: string) {
    try {
      const transaction = this.database.transaction(RECOVERY_STORE, "readonly");
      const record = await requestResult(transaction.objectStore(RECOVERY_STORE).get(id));
      await transactionComplete(transaction);
      if (!record) return null;
      assertEncryptedRecovery(record);
      const entry = await decryptClinicalVaultValue<RecoveryHistoryEntry>(this.requireKey(), record.envelope, recoveryAad(record.id));
      assertRecoveryHistoryEntry(entry, record);
      return structuredClone(entry.snapshot);
    } catch (error) {
      if (error instanceof ClinicalVaultError) throw error;
      throw asStorageError(error, "Could not recover the protected historical snapshot.");
    }
  }

  async restoreRecoveryHistoryEntry(id: string) {
    const transaction = this.database.transaction([CASE_STORE, RECOVERY_STORE], "readonly");
    const recoveryRecord = await requestResult(transaction.objectStore(RECOVERY_STORE).get(id));
    await transactionComplete(transaction);
    if (!recoveryRecord) throw new ClinicalVaultError("CORRUPT_RECORD", "The selected recovery-history version no longer exists.");
    assertEncryptedRecovery(recoveryRecord);
    const entry = await decryptClinicalVaultValue<RecoveryHistoryEntry>(this.requireKey(), recoveryRecord.envelope, recoveryAad(recoveryRecord.id));
    assertRecoveryHistoryEntry(entry, recoveryRecord);
    if (this.metadata.activeEncounterId === entry.encounterId) {
      throw new ClinicalVaultError("CONFLICT", "The active workspace encounter cannot be restored from history. Open another encounter or use the recovery lock action first.");
    }
    const current = await this.loadCase(entry.encounterId);
    if (!current) throw new ClinicalVaultError("CONFLICT", "The current encounter no longer exists. Preview recovery history again.");
    const [currentDigest, archivedDigest] = await Promise.all([
      digestClinicalSnapshotContent(current),
      digestClinicalSnapshotContent(entry.snapshot),
    ]);
    const restoredAt = new Date().toISOString();
    const revision = Math.max(current.revision, entry.snapshot.revision) + 1;
    const provenance: RecoveryImportProvenance = {
      importedAt: restoredAt,
      backupExportedAt: entry.provenance.backupExportedAt,
      sourceRevision: entry.snapshot.revision,
      replacedRevision: current.revision,
      sourceContentDigest: archivedDigest,
      replacedContentDigest: currentDigest,
    };
    const caseData: EndoCase = { ...structuredClone(entry.snapshot.caseData), revision, autosavedAt: restoredAt };
    const restoredSnapshot: ClinicalCaseSnapshot = {
      formatVersion: CLINICAL_VAULT_FORMAT_VERSION,
      encounterId: entry.encounterId,
      revision,
      currentNodeId: entry.snapshot.currentNodeId,
      savedAt: restoredAt,
      caseData,
      summary: buildSummary(caseData, entry.snapshot.currentNodeId, restoredAt, revision),
      recovery: provenance,
    };
    const archiveId = this.recoveryIdFactory();
    const archiveEntry: RecoveryHistoryEntry = {
      id: archiveId,
      encounterId: entry.encounterId,
      archivedAt: restoredAt,
      reason: "recovery-history-restoration",
      provenance,
      snapshot: current,
    };
    const [restoredRecord, archiveRecord] = await Promise.all([
      encryptClinicalVaultValue(this.requireKey(), restoredSnapshot, caseAad(entry.encounterId, revision)).then((envelope): StoredEncryptedCase => ({
        id: entry.encounterId,
        revision,
        envelope,
      })),
      encryptClinicalVaultValue(this.requireKey(), archiveEntry, recoveryAad(archiveId)).then((envelope): StoredEncryptedRecovery => ({
        id: archiveId,
        encounterId: entry.encounterId,
        envelope,
      })),
    ]);

    return new Promise<ClinicalCaseSnapshot>((resolve, reject) => {
      let conflict: ClinicalVaultError | null = null;
      const writeTransaction = this.database.transaction([CASE_STORE, RECOVERY_STORE], "readwrite");
      const caseStore = writeTransaction.objectStore(CASE_STORE);
      const request = caseStore.get(entry.encounterId);
      request.onsuccess = () => {
        const latest = request.result as StoredEncryptedCase | undefined;
        if (!latest || latest.revision !== current.revision) {
          conflict = new ClinicalVaultError("CONFLICT", "The encounter changed while recovery history was being restored. No changes were applied.");
          writeTransaction.abort();
          return;
        }
        writeTransaction.objectStore(RECOVERY_STORE).add(archiveRecord);
        caseStore.put(restoredRecord);
      };
      request.onerror = () => {
        conflict = asStorageError(request.error, "Could not verify the current protected encounter.");
        writeTransaction.abort();
      };
      writeTransaction.oncomplete = () => resolve(restoredSnapshot);
      writeTransaction.onerror = () => {
        if (!conflict) reject(asStorageError(writeTransaction.error, "Could not restore the protected historical snapshot."));
      };
      writeTransaction.onabort = () => reject(conflict || asStorageError(writeTransaction.error, "Historical recovery was interrupted; no changes were applied."));
    });
  }

  async previewEncryptedBackupImport(backup: ClinicalVaultBackup, passphrase: string): Promise<EncryptedBackupImportPreview> {
    const { snapshots } = await decryptAndValidateClinicalVaultBackup(backup, passphrase);
    const localSnapshots = await this.getStoredCaseSnapshots();
    return buildEncryptedBackupImportPreview(backup.formatVersion, backup.exportedAt, snapshots, localSnapshots, this.metadata.activeEncounterId);
  }

  async importNewCasesFromEncryptedBackup(backup: ClinicalVaultBackup, passphrase: string): Promise<EncryptedBackupImportResult> {
    const { snapshots } = await decryptAndValidateClinicalVaultBackup(backup, passphrase);
    const localSnapshots = await this.getStoredCaseSnapshots();
    const preview = await buildEncryptedBackupImportPreview(backup.formatVersion, backup.exportedAt, snapshots, localSnapshots, this.metadata.activeEncounterId);
    const additions = snapshots.filter((snapshot) => !localSnapshots.has(snapshot.encounterId));
    if (!additions.length) return { ...preview, imported: 0, skipped: preview.existingEncounterIds, failed: 0 };

    const key = this.requireKey();
    const encryptedRecords: StoredEncryptedCase[] = [];
    for (const snapshot of additions) {
      encryptedRecords.push({
        id: snapshot.encounterId,
        revision: snapshot.revision,
        envelope: await encryptClinicalVaultValue(key, snapshot, caseAad(snapshot.encounterId, snapshot.revision)),
      });
    }

    try {
      const transaction = this.database.transaction(CASE_STORE, "readwrite");
      const store = transaction.objectStore(CASE_STORE);
      encryptedRecords.forEach((record) => store.add(record));
      await transactionComplete(transaction);
      return {
        ...preview,
        imported: encryptedRecords.length,
        skipped: preview.existingEncounterIds,
        failed: 0,
      };
    } catch (error) {
      throw asStorageError(error, "Encrypted backup import was interrupted; no cases were added.");
    }
  }

  async resolveEncryptedBackupImport(
    backup: ClinicalVaultBackup,
    passphrase: string,
    resolutions: BackupConflictResolution[]
  ): Promise<EncryptedBackupResolutionResult> {
    const { snapshots } = await decryptAndValidateClinicalVaultBackup(backup, passphrase);
    const localSnapshots = await this.getStoredCaseSnapshots();
    const preview = await buildEncryptedBackupImportPreview(
      backup.formatVersion,
      backup.exportedAt,
      snapshots,
      localSnapshots,
      this.metadata.activeEncounterId
    );
    const conflictsById = new Map(preview.conflicts.map((conflict) => [conflict.encounterId, conflict]));
    const resolutionsById = new Map<string, BackupConflictResolution>();
    for (const resolution of resolutions) {
      if (resolutionsById.has(resolution.encounterId) || !conflictsById.has(resolution.encounterId)) {
        throw new ClinicalVaultError("CONFLICT", "Conflict selections do not match the current backup preview.");
      }
      resolutionsById.set(resolution.encounterId, resolution);
    }
    if (resolutionsById.size !== conflictsById.size) {
      throw new ClinicalVaultError("CONFLICT", "Choose Keep local, Replace with backup version, or Decide later for every conflict.");
    }

    for (const conflict of preview.conflicts) {
      const resolution = resolutionsById.get(conflict.encounterId)!;
      if (
        resolution.expectedLocalRevision !== conflict.local.revision ||
        resolution.localDigest !== conflict.localDigest ||
        resolution.incomingDigest !== conflict.incomingDigest
      ) {
        throw new ClinicalVaultError("CONFLICT", "A conflict selection is stale. Preview the backup again.");
      }
      if (resolution.action === "replaceWithBackup" && conflict.activeEncounter) {
        throw new ClinicalVaultError("CONFLICT", "The active workspace encounter cannot be replaced. Open another encounter or use the recovery lock action first.");
      }
    }

    const incomingById = new Map(snapshots.map((snapshot) => [snapshot.encounterId, snapshot]));
    const additions = snapshots.filter((snapshot) => !localSnapshots.has(snapshot.encounterId));
    const replacements = preview.conflicts.filter((conflict) => resolutionsById.get(conflict.encounterId)?.action === "replaceWithBackup");
    const keptLocal = preview.conflicts.filter((conflict) => resolutionsById.get(conflict.encounterId)?.action === "keepLocal").length;
    const deferred = preview.conflicts.filter((conflict) => resolutionsById.get(conflict.encounterId)?.action === "defer").length;
    const result: EncryptedBackupResolutionResult = {
      imported: additions.length,
      replaced: replacements.length,
      archived: replacements.length,
      keptLocal,
      deferred,
      identicalSkipped: preview.identicalContent,
      failed: 0,
    };
    if (!additions.length && !replacements.length) return result;

    const key = this.requireKey();
    const additionRecords = await Promise.all(additions.map(async (snapshot): Promise<StoredEncryptedCase> => ({
      id: snapshot.encounterId,
      revision: snapshot.revision,
      envelope: await encryptClinicalVaultValue(key, snapshot, caseAad(snapshot.encounterId, snapshot.revision)),
    })));
    const preparedReplacements = await Promise.all(replacements.map(async (conflict) => {
      const local = localSnapshots.get(conflict.encounterId)!;
      const incoming = incomingById.get(conflict.encounterId)!;
      const importedAt = new Date().toISOString();
      const revision = Math.max(local.revision, incoming.revision) + 1;
      const provenance: RecoveryImportProvenance = {
        importedAt,
        backupExportedAt: backup.exportedAt,
        sourceRevision: incoming.revision,
        replacedRevision: local.revision,
        sourceContentDigest: conflict.incomingDigest,
        replacedContentDigest: conflict.localDigest,
      };
      const caseData: EndoCase = { ...structuredClone(incoming.caseData), revision, autosavedAt: importedAt };
      const replacementSnapshot: ClinicalCaseSnapshot = {
        formatVersion: CLINICAL_VAULT_FORMAT_VERSION,
        encounterId: incoming.encounterId,
        revision,
        currentNodeId: incoming.currentNodeId,
        savedAt: importedAt,
        caseData,
        summary: buildSummary(caseData, incoming.currentNodeId, importedAt, revision),
        recovery: provenance,
      };
      const recoveryId = this.recoveryIdFactory();
      const recoveryEntry: RecoveryHistoryEntry = {
        id: recoveryId,
        encounterId: local.encounterId,
        archivedAt: importedAt,
        reason: "backup-conflict-replacement",
        provenance,
        snapshot: local,
      };
      return {
        expectedRevision: local.revision,
        caseRecord: {
          id: replacementSnapshot.encounterId,
          revision,
          envelope: await encryptClinicalVaultValue(key, replacementSnapshot, caseAad(replacementSnapshot.encounterId, revision)),
        } satisfies StoredEncryptedCase,
        recoveryRecord: {
          id: recoveryId,
          encounterId: local.encounterId,
          envelope: await encryptClinicalVaultValue(key, recoveryEntry, recoveryAad(recoveryId)),
        } satisfies StoredEncryptedRecovery,
      };
    }));

    return new Promise<EncryptedBackupResolutionResult>((resolve, reject) => {
      let conflict: ClinicalVaultError | null = null;
      const transaction = this.database.transaction([CASE_STORE, RECOVERY_STORE], "readwrite");
      const caseStore = transaction.objectStore(CASE_STORE);
      const recoveryStore = transaction.objectStore(RECOVERY_STORE);
      additionRecords.forEach((record) => caseStore.add(record));

      let remainingChecks = preparedReplacements.length;
      const writeReplacements = () => {
        preparedReplacements.forEach((prepared) => {
          recoveryStore.add(prepared.recoveryRecord);
          caseStore.put(prepared.caseRecord);
        });
      };
      if (!remainingChecks) writeReplacements();
      preparedReplacements.forEach((prepared) => {
        const request = caseStore.get(prepared.caseRecord.id);
        request.onsuccess = () => {
          const current = request.result as StoredEncryptedCase | undefined;
          if (!current || current.revision !== prepared.expectedRevision) {
            conflict = new ClinicalVaultError("CONFLICT", "A local encounter changed after preview. No backup changes were applied.");
            transaction.abort();
            return;
          }
          remainingChecks -= 1;
          if (!remainingChecks) writeReplacements();
        };
        request.onerror = () => {
          conflict = asStorageError(request.error, "Could not verify the current protected encounter.");
          transaction.abort();
        };
      });
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => {
        if (!conflict) reject(asStorageError(transaction.error, "Encrypted backup conflict resolution failed; no changes were applied."));
      };
      transaction.onabort = () => reject(conflict || asStorageError(transaction.error, "Encrypted backup conflict resolution was interrupted; no changes were applied."));
    });
  }

  close() {
    this.key = null;
    this.database.close();
  }
}

export class ClinicalVaultStore {
  constructor(
    private readonly factory: IDBFactory = globalThis.indexedDB,
    private readonly databaseName = CLINICAL_VAULT_DATABASE_NAME,
    private readonly recoveryIdFactory: () => string = () => globalThis.crypto.randomUUID()
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
      return new ClinicalVaultSession(database, key, metadata, this.recoveryIdFactory);
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
      return new ClinicalVaultSession(database, key, value, this.recoveryIdFactory);
    } catch (error) {
      database.close();
      throw asStorageError(error, "Could not unlock the clinical vault.");
    }
  }

  async restoreEncryptedBackup(backup: ClinicalVaultBackup, passphrase: string, replaceExisting = false) {
    const { key } = await decryptAndValidateClinicalVaultBackup(backup, passphrase);

    const database = await openDatabase(this.factory, this.databaseName);
    try {
      const readTransaction = database.transaction(METADATA_STORE, "readonly");
      const existing = await requestResult(readTransaction.objectStore(METADATA_STORE).get(VAULT_METADATA_ID));
      await transactionComplete(readTransaction);
      if (existing && !replaceExisting) {
        throw new ClinicalVaultError("VAULT_EXISTS", "A clinical vault already exists. Confirm replacement before restoring a backup.");
      }

      const writeTransaction = database.transaction([METADATA_STORE, CASE_STORE, RECOVERY_STORE], "readwrite");
      writeTransaction.objectStore(METADATA_STORE).clear();
      writeTransaction.objectStore(CASE_STORE).clear();
      writeTransaction.objectStore(RECOVERY_STORE).clear();
      writeTransaction.objectStore(METADATA_STORE).put(backup.metadata);
      backup.cases.forEach((record) => writeTransaction.objectStore(CASE_STORE).put(record));
      (backup.recoveryHistory || []).forEach((record) => writeTransaction.objectStore(RECOVERY_STORE).put(record));
      await transactionComplete(writeTransaction);
      return new ClinicalVaultSession(database, key, structuredClone(backup.metadata), this.recoveryIdFactory);
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
