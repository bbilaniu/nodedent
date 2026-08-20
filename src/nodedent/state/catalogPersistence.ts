import { isAnesthesiaRoute } from "../workflow/anesthesia";
import { anesthesiaCatalogFields } from "../workflow/anesthesiaCatalog";
import type { CatalogItem } from "../workflow/catalogs";
import { isolationCatalogFields } from "../workflow/isolationCatalog";
import { loadUserAnesthesiaCatalogItems } from "./anesthesiaCatalogPersistence";
import { loadUserIsolationCatalogItems } from "./isolationCatalogPersistence";

export const USER_CATALOG_STORAGE_KEY = "nodedent.userCatalogs.v1";
export const USER_CATALOG_EXPORT_KIND = "nodedent-user-catalogues";
export const USER_CATALOG_EXPORT_VERSION = 1;
export const MAX_USER_CATALOG_IMPORT_BYTES = 1024 * 1024;

type CatalogStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type StoredUserCatalogState = {
  schemaVersion: 1;
  items: CatalogItem[];
};

export type UserCatalogExport = {
  exportKind: typeof USER_CATALOG_EXPORT_KIND;
  formatVersion: typeof USER_CATALOG_EXPORT_VERSION;
  exportedAt: string;
  state: StoredUserCatalogState;
};

export type UserCatalogImportPreview = {
  additions: number;
  equivalentItems: number;
  idConflicts: number;
  itemsByCategory: Record<string, number>;
};

function getDefaultCatalogStorage(): CatalogStorage | undefined {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

function normalizeString(value: unknown, maximumLength = 200) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().normalize("NFC");
  return normalized && normalized.length <= maximumLength ? normalized : undefined;
}

function normalizeAliases(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) return undefined;
  const aliases = value.map((item) => normalizeString(item)).filter(Boolean) as string[];
  return aliases.length ? aliases : undefined;
}

function isKnownCatalogField(category: string, field: string) {
  if (category === "anesthesia") return (anesthesiaCatalogFields as readonly string[]).includes(field);
  if (category === "isolation") return (isolationCatalogFields as readonly string[]).includes(field);
  return false;
}

export function normalizeUserCatalogItem(value: unknown): CatalogItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);
  const label = normalizeString(record.label);
  const category = normalizeString(record.category, 80);
  const applicability = record.appliesTo && typeof record.appliesTo === "object" && !Array.isArray(record.appliesTo)
    ? record.appliesTo as Record<string, unknown>
    : undefined;
  const route = normalizeString(applicability?.route, 80);
  const field = normalizeString(applicability?.field, 80);

  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id) || !label || !category) return undefined;
  if (record.owner !== "user" || !["anesthesia", "isolation"].includes(category)) return undefined;
  if (field && !isKnownCatalogField(category, field)) return undefined;
  if (category === "anesthesia" && route && !isAnesthesiaRoute(route)) return undefined;
  if (category === "isolation" && route) return undefined;

  const sortOrder = typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder) && record.sortOrder >= 0
    ? record.sortOrder
    : undefined;

  return {
    id,
    owner: "user",
    category,
    label,
    aliases: normalizeAliases(record.aliases),
    appliesTo: route || field ? { route, field } : undefined,
    active: typeof record.active === "boolean" ? record.active : undefined,
    favorite: typeof record.favorite === "boolean" ? record.favorite : undefined,
    sortOrder,
    source: normalizeString(record.source),
    version: normalizeString(record.version, 80),
  };
}

function normalizeStoredUserCatalogState(value: unknown, rejectInvalidItems = false): StoredUserCatalogState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || !Array.isArray(record.items)) return undefined;
  const items = record.items.map(normalizeUserCatalogItem);
  if (rejectInvalidItems && items.some((item) => !item)) return undefined;
  return { schemaVersion: 1, items: items.filter(Boolean) as CatalogItem[] };
}

function deduplicateCatalogItems(items: CatalogItem[]) {
  const byId = new Map<string, CatalogItem>();
  items.forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}

export function loadUserCatalogItems(storage = getDefaultCatalogStorage()): CatalogItem[] {
  if (!storage) return [];
  try {
    const stored = storage.getItem(USER_CATALOG_STORAGE_KEY);
    if (stored) return normalizeStoredUserCatalogState(JSON.parse(stored))?.items || [];
  } catch {
    return [];
  }

  const legacyItems = deduplicateCatalogItems([
    ...loadUserAnesthesiaCatalogItems(storage),
    ...loadUserIsolationCatalogItems(storage),
  ]);
  if (legacyItems.length) saveUserCatalogItems(legacyItems, storage);
  return legacyItems;
}

export function saveUserCatalogItems(items: CatalogItem[], storage = getDefaultCatalogStorage()) {
  if (!storage) return;
  const state: StoredUserCatalogState = {
    schemaVersion: 1,
    items: deduplicateCatalogItems(items.map(normalizeUserCatalogItem).filter(Boolean) as CatalogItem[]),
  };
  storage.setItem(USER_CATALOG_STORAGE_KEY, JSON.stringify(state));
}

export function buildUserCatalogExport(items: CatalogItem[], now: Date = new Date()): UserCatalogExport {
  return {
    exportKind: USER_CATALOG_EXPORT_KIND,
    formatVersion: USER_CATALOG_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    state: {
      schemaVersion: 1,
      items: deduplicateCatalogItems(items.map(normalizeUserCatalogItem).filter(Boolean) as CatalogItem[]),
    },
  };
}

export function buildUserCatalogExportFilename(now: Date = new Date()) {
  const timestamp = [
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ].map((part) => String(part).padStart(2, "0")).join("_");
  return `nodedent_catalogues_${timestamp}.json`;
}

export function parseUserCatalogExport(input: string | unknown): UserCatalogExport {
  if (typeof input === "string" && input.length > MAX_USER_CATALOG_IMPORT_BYTES) throw new Error("Catalogue import exceeds the 1 MB limit.");
  let value: unknown;
  try {
    value = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw new Error("Catalogue import is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Catalogue import is malformed.");
  const record = value as Record<string, unknown>;
  const state = normalizeStoredUserCatalogState(record.state, true);
  if (
    record.exportKind !== USER_CATALOG_EXPORT_KIND ||
    record.formatVersion !== USER_CATALOG_EXPORT_VERSION ||
    typeof record.exportedAt !== "string" ||
    !Number.isFinite(new Date(record.exportedAt).getTime()) ||
    !state
  ) {
    throw new Error("Catalogue import is not a supported NodeDent catalogue export.");
  }
  const ids = new Set<string>();
  for (const item of state.items) {
    if (ids.has(item.id)) throw new Error("Catalogue import contains duplicate item identifiers.");
    ids.add(item.id);
  }
  return { exportKind: USER_CATALOG_EXPORT_KIND, formatVersion: 1, exportedAt: record.exportedAt, state };
}

function comparableItem(item: CatalogItem) {
  return JSON.stringify(normalizeUserCatalogItem(item));
}

export function previewUserCatalogImport(currentItems: CatalogItem[], importedItems: CatalogItem[]): UserCatalogImportPreview {
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  const preview: UserCatalogImportPreview = { additions: 0, equivalentItems: 0, idConflicts: 0, itemsByCategory: {} };
  importedItems.forEach((item) => {
    preview.itemsByCategory[item.category] = (preview.itemsByCategory[item.category] || 0) + 1;
    const current = currentById.get(item.id);
    if (!current) preview.additions += 1;
    else if (comparableItem(current) === comparableItem(item)) preview.equivalentItems += 1;
    else preview.idConflicts += 1;
  });
  return preview;
}

export function mergeNewUserCatalogItems(currentItems: CatalogItem[], importedItems: CatalogItem[]) {
  const currentIds = new Set(currentItems.map((item) => item.id));
  return deduplicateCatalogItems([...currentItems, ...importedItems.filter((item) => !currentIds.has(item.id))]);
}
