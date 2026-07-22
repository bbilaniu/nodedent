import {
  LEGACY_CASE_INDEX_KEY,
  LEGACY_CASE_RECORD_PREFIX,
  LEGACY_STORAGE_KEY,
} from "./persistence";

export const LEGACY_CLINICAL_STORAGE_KEYS = [LEGACY_STORAGE_KEY, LEGACY_CASE_INDEX_KEY] as const;

function getStorage(storage?: Storage) {
  return storage || window.localStorage;
}

export function listLegacyClinicalStorageKeys(storage?: Storage) {
  const target = getStorage(storage);
  const keys: string[] = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key && (LEGACY_CLINICAL_STORAGE_KEYS.includes(key as typeof LEGACY_CLINICAL_STORAGE_KEYS[number]) || key.startsWith(LEGACY_CASE_RECORD_PREFIX))) {
      keys.push(key);
    }
  }
  return keys.sort();
}

export function buildLegacyClinicalStorageBackup(storage?: Storage) {
  const target = getStorage(storage);
  return {
    exportKind: "nodedent-legacy-local-storage-backup",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    warning: "Plaintext legacy backup. Contains the original browser-storage values and may contain identifying clinical information.",
    items: listLegacyClinicalStorageKeys(target).map((key) => ({ key, value: target.getItem(key) || "" })),
  };
}

export function clearLegacyClinicalStorage(storage?: Storage) {
  const target = getStorage(storage);
  const keys = listLegacyClinicalStorageKeys(target);
  keys.forEach((key) => target.removeItem(key));
  return keys.length;
}
