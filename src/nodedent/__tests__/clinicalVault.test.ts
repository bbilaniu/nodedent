import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { buildClinicalExportFilename, buildVaultBackupFilename, sanitizeFilenameSegment } from "../notes/exportFilename";
import {
  ClinicalVaultError,
  ClinicalVaultStore,
} from "../state/clinicalVault";
import {
  buildLegacyClinicalStorageBackup,
  clearLegacyClinicalStorage,
  listLegacyClinicalStorageKeys,
} from "../state/legacyClinicalStorage";
import {
  LEGACY_CASE_INDEX_KEY,
  LEGACY_CASE_RECORD_PREFIX,
  LEGACY_STORAGE_KEY,
  createFreshCase,
} from "../state/persistence";

const PASSPHRASE = "clinic test passphrase 2026";

function clinicalCase() {
  return {
    ...createFreshCase("2026-07-22T15:00:00.000Z"),
    encounterId: "abcdef12-abcd-4abc-8abc-abcdefabcdef",
    patientNumber: "12345",
    tooth: "36",
    procedureType: "RCT",
    diagnosis: { pulpal: "irreversible pulpitis", apical: "symptomatic apical periodontitis" },
  };
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rawCaseRecords(factory: IDBFactory, databaseName: string) {
  const database = await requestResult(factory.open(databaseName));
  try {
    return await requestResult(database.transaction("cases", "readonly").objectStore("cases").getAll());
  } finally {
    database.close();
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("clinical vault stores encrypted case envelopes and restores authenticated data", async () => {
  const factory = new IDBFactory();
  const databaseName = "vault-encryption-test";
  const store = new ClinicalVaultStore(factory, databaseName);
  const session = await store.create(PASSPHRASE);
  const caseData = clinicalCase();

  const saved = await session.saveCase(caseData, "preop", 0);
  assert.equal(saved.revision, 1);
  assert.equal((await session.listCases())[0]?.patientNumber, "12345");
  assert.equal((await session.loadCase(caseData.encounterId))?.caseData.diagnosis?.pulpal, "irreversible pulpitis");

  const rawRecords = await rawCaseRecords(factory, databaseName);
  const rawText = JSON.stringify(rawRecords);
  assert.equal(rawRecords.length, 1);
  assert.equal(rawText.includes("12345"), false);
  assert.equal(rawText.includes("irreversible pulpitis"), false);
  assert.match(rawText, /ciphertext/u);

  const backup = await session.exportEncryptedBackup();
  session.close();

  const restoredFactory = new IDBFactory();
  const restoredStore = new ClinicalVaultStore(restoredFactory, "vault-restore-test");
  const restoredSession = await restoredStore.restoreEncryptedBackup(backup, PASSPHRASE);
  assert.equal((await restoredSession.loadActiveCase())?.caseData.patientNumber, "12345");

  const damagedBackup = structuredClone(backup);
  const ciphertext = damagedBackup.cases[0].envelope.ciphertext;
  damagedBackup.cases[0].envelope.ciphertext = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
  await assert.rejects(
    restoredStore.restoreEncryptedBackup(damagedBackup, PASSPHRASE, true),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "INVALID_BACKUP"
  );
  assert.equal((await restoredSession.loadActiveCase())?.caseData.patientNumber, "12345");
  restoredSession.close();
});

test("a new vault persists and reopens its intentionally incomplete initial draft", async () => {
  const factory = new IDBFactory();
  const store = new ClinicalVaultStore(factory, "vault-initial-draft-test");
  const session = await store.create(PASSPHRASE);
  const freshDraft = createFreshCase("2026-08-20T12:00:00.000Z");
  assert.equal(freshDraft.tooth, "");

  const saved = await session.saveCase(freshDraft, "preop", 0);
  assert.equal(saved.revision, 1);
  assert.equal((await session.listCases()).length, 1);
  assert.equal((await session.loadActiveCase())?.caseData.tooth, "");
  session.close();

  const reopened = await store.unlock(PASSPHRASE);
  assert.equal((await reopened.loadActiveCase())?.caseData.tooth, "");
  reopened.close();
});

test("encrypted backup import previews and adds only new encounter IDs", async () => {
  const sourceFactory = new IDBFactory();
  const sourceStore = new ClinicalVaultStore(sourceFactory, "vault-import-source-test");
  const sourceSession = await sourceStore.create(PASSPHRASE);
  const sharedEncounter = clinicalCase();
  const newEncounter = {
    ...clinicalCase(),
    encounterId: "bbbbbb12-abcd-4abc-8abc-abcdefabcdef",
    patientNumber: "67890",
    tooth: "37",
  };
  await sourceSession.saveCase(sharedEncounter, "preop", 0);
  await sourceSession.saveCase(newEncounter, "preop", 0);
  const backup = await sourceSession.exportEncryptedBackup();

  const targetFactory = new IDBFactory();
  const targetStore = new ClinicalVaultStore(targetFactory, "vault-import-target-test");
  const targetSession = await targetStore.create("different target passphrase 2026");
  const localShared = { ...sharedEncounter, tooth: "38" };
  await targetSession.saveCase(localShared, "preop", 0);
  await targetSession.saveCase(localShared, "preop", 1);

  const preview = await targetSession.previewEncryptedBackupImport(backup, PASSPHRASE);
  assert.deepEqual(preview, {
    formatVersion: 1,
    exportedAt: backup.exportedAt,
    totalCases: 2,
    additions: 1,
    existingEncounterIds: 1,
    sameRevision: 0,
    incomingNewer: 0,
    incomingOlder: 1,
  });

  await assert.rejects(
    targetSession.previewEncryptedBackupImport(backup, "wrong backup passphrase 2026"),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "INVALID_PASSPHRASE"
  );
  assert.equal((await targetSession.listCases()).length, 1);

  const result = await targetSession.importNewCasesFromEncryptedBackup(backup, PASSPHRASE);
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed, 0);
  assert.equal((await targetSession.listCases()).length, 2);
  assert.equal((await targetSession.loadCase(sharedEncounter.encounterId))?.caseData.tooth, "38");
  assert.equal((await targetSession.loadCase(newEncounter.encounterId))?.caseData.patientNumber, "67890");

  const repeated = await targetSession.importNewCasesFromEncryptedBackup(backup, PASSPHRASE);
  assert.equal(repeated.imported, 0);
  assert.equal(repeated.additions, 0);
  assert.equal(repeated.sameRevision, 1);
  assert.equal(repeated.incomingOlder, 1);

  const damagedBackup = structuredClone(backup);
  const ciphertext = damagedBackup.cases[1].envelope.ciphertext;
  damagedBackup.cases[1].envelope.ciphertext = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
  await assert.rejects(
    targetSession.importNewCasesFromEncryptedBackup(damagedBackup, PASSPHRASE),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "INVALID_BACKUP"
  );
  assert.equal((await targetSession.listCases()).length, 2);

  const duplicateBackup = structuredClone(backup);
  duplicateBackup.cases.push(structuredClone(duplicateBackup.cases[0]));
  await assert.rejects(
    targetSession.previewEncryptedBackupImport(duplicateBackup, PASSPHRASE),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "INVALID_BACKUP"
  );

  await assert.rejects(
    sourceSession.saveCase({
      ...newEncounter,
      encounterId: "cccccc12-abcd-4abc-8abc-abcdefabcdef",
      canals: [],
    }, "preop", 0),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "CORRUPT_RECORD"
  );
  assert.equal((await targetSession.listCases()).length, 2);

  sourceSession.close();
  targetSession.close();
});

test("clinical vault rejects wrong passphrases and stale writes", async () => {
  const factory = new IDBFactory();
  const store = new ClinicalVaultStore(factory, "vault-conflict-test");
  const firstSession = await store.create(PASSPHRASE);
  const caseData = clinicalCase();
  await firstSession.saveCase(caseData, "preop", 0);

  await assert.rejects(
    store.unlock("wrong passphrase is long enough"),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "INVALID_PASSPHRASE"
  );

  const secondSession = await store.unlock(PASSPHRASE);
  await firstSession.saveCase({ ...caseData, tooth: "37" }, "preop", 1);
  await assert.rejects(
    secondSession.saveCase({ ...caseData, tooth: "38" }, "preop", 1),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "CONFLICT"
  );
  firstSession.close();
  secondSession.close();
  await store.deleteVault();
  assert.equal(await store.hasVault(), false);
});

test("legacy clinical localStorage remains raw, separate, and explicitly deletable", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_STORAGE_KEY, "{not-valid-json");
  storage.setItem(LEGACY_CASE_INDEX_KEY, "legacy-index");
  storage.setItem(`${LEGACY_CASE_RECORD_PREFIX}12345`, "raw-clinical-value");
  storage.setItem("nodedent-theme", "dark");

  assert.deepEqual(listLegacyClinicalStorageKeys(storage), [
    LEGACY_CASE_INDEX_KEY,
    `${LEGACY_CASE_RECORD_PREFIX}12345`,
    LEGACY_STORAGE_KEY,
  ].sort());
  const backup = buildLegacyClinicalStorageBackup(storage);
  assert.equal(backup.items.find((item) => item.key === LEGACY_STORAGE_KEY)?.value, "{not-valid-json");
  assert.equal(clearLegacyClinicalStorage(storage), 3);
  assert.equal(storage.getItem("nodedent-theme"), "dark");
});

test("clinical export filenames contain chart and filing metadata but no tooth or diagnosis", () => {
  const caseData = clinicalCase();
  const filename = buildClinicalExportFilename(caseData, "json");

  assert.equal(filename, "2026_07_22_12345_ENDO_ABCDEF.json");
  assert.equal(filename.includes("36"), false);
  assert.equal(filename.includes("pulpitis"), false);
  assert.equal(sanitizeFilenameSegment("../Chart 12 / name", "NO-CHART"), "Chart-12-name");
  assert.equal(buildVaultBackupFilename(new Date(2026, 7, 20, 12, 34, 56)), "nodedent_encrypted_vault_2026_08_20_12_34_56.nodedent");
});
