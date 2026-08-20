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

async function rawRecoveryRecords(factory: IDBFactory, databaseName: string) {
  const database = await requestResult(factory.open(databaseName));
  try {
    return await requestResult(database.transaction("recoveryHistory", "readonly").objectStore("recoveryHistory").getAll());
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
  assert.equal(preview.formatVersion, 2);
  assert.equal(preview.exportedAt, backup.exportedAt);
  assert.equal(preview.totalCases, 2);
  assert.equal(preview.additions, 1);
  assert.equal(preview.existingEncounterIds, 1);
  assert.equal(preview.sameRevision, 0);
  assert.equal(preview.incomingNewer, 0);
  assert.equal(preview.incomingOlder, 1);
  assert.equal(preview.identicalContent, 0);
  assert.equal(preview.conflicts.length, 1);
  assert.equal(preview.conflicts[0].classification, "incomingOlder");
  assert.match(preview.conflicts[0].differences.join(" "), /Tooth/u);

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

  await sourceSession.saveCase({
    ...newEncounter,
    encounterId: "cccccc12-abcd-4abc-8abc-abcdefabcdef",
    tooth: "",
  }, "preop", 0);
  const malformedCaseBackup = await sourceSession.exportEncryptedBackup();
  await assert.rejects(
    targetSession.previewEncryptedBackupImport(malformedCaseBackup, PASSPHRASE),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "INVALID_BACKUP"
  );
  assert.equal((await targetSession.listCases()).length, 2);

  sourceSession.close();
  targetSession.close();
});

test("backup conflicts require explicit resolution and archive displaced snapshots", async () => {
  const sourceStore = new ClinicalVaultStore(new IDBFactory(), "vault-resolution-source-test");
  const sourceSession = await sourceStore.create(PASSPHRASE);
  const incomingConflict = { ...clinicalCase(), tooth: "36" };
  const incomingAddition = {
    ...clinicalCase(),
    encounterId: "dddddd12-abcd-4abc-8abc-abcdefabcdef",
    patientNumber: "24680",
    tooth: "37",
  };
  const incomingDeferred = {
    ...clinicalCase(),
    encounterId: "ababab12-abcd-4abc-8abc-abcdefabcdef",
    patientNumber: "11223",
    tooth: "45",
  };
  await sourceSession.saveCase(incomingConflict, "preop", 0);
  await sourceSession.saveCase(incomingAddition, "preop", 0);
  await sourceSession.saveCase(incomingDeferred, "preop", 0);
  const backup = await sourceSession.exportEncryptedBackup();
  assert.equal(backup.formatVersion, 2);
  assert.deepEqual(backup.recoveryHistory, []);

  const targetFactory = new IDBFactory();
  const targetStore = new ClinicalVaultStore(targetFactory, "vault-resolution-target-test");
  const targetSession = await targetStore.create("target recovery passphrase 2026");
  await targetSession.saveCase({ ...incomingConflict, tooth: "38" }, "preop", 0);
  await targetSession.saveCase({ ...incomingDeferred, tooth: "44" }, "preop", 0);
  const activeOther = {
    ...clinicalCase(),
    encounterId: "eeeeee12-abcd-4abc-8abc-abcdefabcdef",
    patientNumber: "13579",
    tooth: "46",
  };
  await targetSession.saveCase(activeOther, "preop", 0);

  const preview = await targetSession.previewEncryptedBackupImport(backup, PASSPHRASE);
  assert.equal(preview.additions, 1);
  assert.equal(preview.conflicts.length, 2);
  const conflict = preview.conflicts.find((item) => item.encounterId === incomingConflict.encounterId)!;
  const deferredConflict = preview.conflicts.find((item) => item.encounterId === incomingDeferred.encounterId)!;
  assert.equal(conflict.classification, "divergentSameRevision");
  assert.equal(conflict.activeEncounter, false);
  assert.equal(conflict.local.tooth, "38");
  assert.equal(conflict.incoming.tooth, "36");

  await assert.rejects(
    targetSession.resolveEncryptedBackupImport(backup, PASSPHRASE, []),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "CONFLICT"
  );
  assert.equal((await targetSession.listCases()).length, 3);

  const result = await targetSession.resolveEncryptedBackupImport(backup, PASSPHRASE, [
    {
      encounterId: conflict.encounterId,
      action: "replaceWithBackup",
      expectedLocalRevision: conflict.local.revision,
      localDigest: conflict.localDigest,
      incomingDigest: conflict.incomingDigest,
    },
    {
      encounterId: deferredConflict.encounterId,
      action: "defer",
      expectedLocalRevision: deferredConflict.local.revision,
      localDigest: deferredConflict.localDigest,
      incomingDigest: deferredConflict.incomingDigest,
    },
  ]);
  assert.deepEqual(result, {
    imported: 1,
    replaced: 1,
    archived: 1,
    keptLocal: 0,
    deferred: 1,
    identicalSkipped: 0,
    failed: 0,
  });
  assert.equal((await targetSession.loadCase(incomingConflict.encounterId))?.caseData.tooth, "36");
  assert.equal((await targetSession.loadCase(incomingConflict.encounterId))?.revision, 2);
  assert.equal((await targetSession.loadCase(incomingAddition.encounterId))?.caseData.patientNumber, "24680");
  assert.equal((await targetSession.loadCase(incomingDeferred.encounterId))?.caseData.tooth, "44");
  const history = await targetSession.listRecoveryHistory(incomingConflict.encounterId);
  assert.equal(history.length, 1);
  assert.equal(history[0].revision, 1);
  assert.equal(history[0].tooth, "38");
  assert.equal((await targetSession.loadRecoveryHistorySnapshot(history[0].id))?.caseData.tooth, "38");
  const rawHistoryText = JSON.stringify(await rawRecoveryRecords(targetFactory, "vault-resolution-target-test"));
  assert.equal(rawHistoryText.includes("12345"), false);
  assert.equal(rawHistoryText.includes("backup-conflict-replacement"), false);
  assert.match(rawHistoryText, /ciphertext/u);

  const recoveredBackup = await targetSession.exportEncryptedBackup();
  assert.equal(recoveredBackup.recoveryHistory?.length, 1);
  const restoredStore = new ClinicalVaultStore(new IDBFactory(), "vault-resolution-restored-test");
  const restoredSession = await restoredStore.restoreEncryptedBackup(recoveredBackup, "target recovery passphrase 2026");
  assert.equal((await restoredSession.listRecoveryHistory()).length, 1);
  assert.equal((await restoredSession.loadCase(incomingConflict.encounterId))?.caseData.tooth, "36");

  const legacyBackup = structuredClone(recoveredBackup) as typeof recoveredBackup;
  legacyBackup.formatVersion = 1;
  delete legacyBackup.recoveryHistory;
  const legacyStore = new ClinicalVaultStore(new IDBFactory(), "vault-resolution-v1-test");
  const legacySession = await legacyStore.restoreEncryptedBackup(legacyBackup, "target recovery passphrase 2026");
  assert.equal((await legacySession.listCases()).length, 4);
  assert.equal((await legacySession.listRecoveryHistory()).length, 0);

  const historyRestored = await targetSession.restoreRecoveryHistoryEntry(history[0].id);
  assert.equal(historyRestored.caseData.tooth, "38");
  assert.equal(historyRestored.revision, 3);
  assert.equal((await targetSession.listRecoveryHistory(incomingConflict.encounterId)).length, 2);

  await targetSession.deleteCase(incomingConflict.encounterId);
  assert.equal((await targetSession.listRecoveryHistory(incomingConflict.encounterId)).length, 0);

  sourceSession.close();
  targetSession.close();
  restoredSession.close();
  legacySession.close();
});

test("backup conflict preview recognizes identical content and rejects active or stale replacement", async () => {
  const sourceStore = new ClinicalVaultStore(new IDBFactory(), "vault-classification-source-test");
  const sourceSession = await sourceStore.create(PASSPHRASE);
  const sameContent = clinicalCase();
  await sourceSession.saveCase(sameContent, "preop", 0);
  const originalBackup = await sourceSession.exportEncryptedBackup();
  await sourceSession.saveCase({ ...sameContent, tooth: "37" }, "preop", 1);
  const newerBackup = await sourceSession.exportEncryptedBackup();
  await sourceSession.saveCase({ ...sameContent, tooth: "39" }, "preop", 2);
  const aheadBackup = await sourceSession.exportEncryptedBackup();

  const targetStore = new ClinicalVaultStore(new IDBFactory(), "vault-classification-target-test");
  const targetSession = await targetStore.create("classification target passphrase 2026");
  await targetSession.saveCase(sameContent, "preop", 0);
  await targetSession.saveCase(sameContent, "preop", 1);

  const identicalPreview = await targetSession.previewEncryptedBackupImport(originalBackup, PASSPHRASE);
  assert.equal(identicalPreview.identicalContent, 1);
  assert.equal(identicalPreview.conflicts.length, 0);
  assert.equal(identicalPreview.incomingOlder, 1);

  const activePreview = await targetSession.previewEncryptedBackupImport(newerBackup, PASSPHRASE);
  assert.equal(activePreview.conflicts[0].classification, "divergentSameRevision");
  assert.equal(activePreview.conflicts[0].activeEncounter, true);
  const activeConflict = activePreview.conflicts[0];
  await assert.rejects(
    targetSession.resolveEncryptedBackupImport(newerBackup, PASSPHRASE, [{
      encounterId: activeConflict.encounterId,
      action: "replaceWithBackup",
      expectedLocalRevision: activeConflict.local.revision,
      localDigest: activeConflict.localDigest,
      incomingDigest: activeConflict.incomingDigest,
    }]),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "CONFLICT"
  );
  await targetSession.detachActiveEncounterForRecovery();
  assert.equal((await targetSession.previewEncryptedBackupImport(newerBackup, PASSPHRASE)).conflicts[0].activeEncounter, false);
  const aheadPreview = await targetSession.previewEncryptedBackupImport(aheadBackup, PASSPHRASE);
  assert.equal(aheadPreview.conflicts[0].classification, "incomingNewer");

  const otherCase = {
    ...clinicalCase(),
    encounterId: "ffffff12-abcd-4abc-8abc-abcdefabcdef",
    tooth: "47",
  };
  await targetSession.saveCase(otherCase, "preop", 0);
  const stalePreview = await targetSession.previewEncryptedBackupImport(newerBackup, PASSPHRASE);
  const staleConflict = stalePreview.conflicts[0];
  await targetSession.saveCase({ ...sameContent, tooth: "48" }, "preop", 2);
  await targetSession.saveCase(otherCase, "preop", 1);
  await assert.rejects(
    targetSession.resolveEncryptedBackupImport(newerBackup, PASSPHRASE, [{
      encounterId: staleConflict.encounterId,
      action: "replaceWithBackup",
      expectedLocalRevision: staleConflict.local.revision,
      localDigest: staleConflict.localDigest,
      incomingDigest: staleConflict.incomingDigest,
    }]),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "CONFLICT"
  );
  assert.equal((await targetSession.loadCase(sameContent.encounterId))?.caseData.tooth, "48");
  assert.equal((await targetSession.listRecoveryHistory()).length, 0);

  sourceSession.close();
  targetSession.close();
});

test("version 1 vault databases upgrade with an empty recovery-history store", async () => {
  const factory = new IDBFactory();
  const databaseName = "vault-database-migration-test";
  await new Promise<void>((resolve, reject) => {
    const request = factory.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("metadata", { keyPath: "id" });
      request.result.createObjectStore("cases", { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });

  const store = new ClinicalVaultStore(factory, databaseName);
  const session = await store.create(PASSPHRASE);
  await session.saveCase(clinicalCase(), "preop", 0);
  assert.equal((await session.listCases()).length, 1);
  assert.deepEqual(await session.listRecoveryHistory(), []);
  session.close();
});

test("backup conflict resolution aborts every selected change when one transactional write fails", async () => {
  const first = clinicalCase();
  const second = {
    ...clinicalCase(),
    encounterId: "12121212-abcd-4abc-8abc-abcdefabcdef",
    tooth: "37",
  };
  const sourceStore = new ClinicalVaultStore(new IDBFactory(), "vault-atomic-source-test");
  const sourceSession = await sourceStore.create(PASSPHRASE);
  await sourceSession.saveCase(first, "preop", 0);
  await sourceSession.saveCase(second, "preop", 0);
  const backup = await sourceSession.exportEncryptedBackup();

  const targetStore = new ClinicalVaultStore(
    new IDBFactory(),
    "vault-atomic-target-test",
    () => "duplicate-recovery-id"
  );
  const targetSession = await targetStore.create("atomic target passphrase 2026");
  await targetSession.saveCase({ ...first, tooth: "46" }, "preop", 0);
  await targetSession.saveCase({ ...second, tooth: "47" }, "preop", 0);
  await targetSession.saveCase({
    ...clinicalCase(),
    encounterId: "34343434-abcd-4abc-8abc-abcdefabcdef",
    tooth: "48",
  }, "preop", 0);
  const preview = await targetSession.previewEncryptedBackupImport(backup, PASSPHRASE);
  assert.equal(preview.conflicts.length, 2);

  await assert.rejects(
    targetSession.resolveEncryptedBackupImport(backup, PASSPHRASE, preview.conflicts.map((conflict) => ({
      encounterId: conflict.encounterId,
      action: "replaceWithBackup" as const,
      expectedLocalRevision: conflict.local.revision,
      localDigest: conflict.localDigest,
      incomingDigest: conflict.incomingDigest,
    }))),
    (error: unknown) => error instanceof ClinicalVaultError && error.code === "STORAGE_FAILURE"
  );
  assert.equal((await targetSession.loadCase(first.encounterId))?.caseData.tooth, "46");
  assert.equal((await targetSession.loadCase(second.encounterId))?.caseData.tooth, "47");
  assert.deepEqual(await targetSession.listRecoveryHistory(), []);

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
