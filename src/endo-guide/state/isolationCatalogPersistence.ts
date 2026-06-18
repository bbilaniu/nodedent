import type { IsolationCatalogField } from "../workflow/isolationCatalog";
import { isolationCatalogFields } from "../workflow/isolationCatalog";
import type { CatalogItem } from "../workflow/catalogs";

export const USER_ISOLATION_CATALOG_STORAGE_KEY = "nodedent.userCatalog.sharedIsolation.v1";

type CatalogStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type StoredUserIsolationCatalog = {
  version: 1;
  items: CatalogItem[];
};

function getDefaultCatalogStorage(): CatalogStorage | undefined {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

function isIsolationCatalogField(value: unknown): value is IsolationCatalogField {
  return typeof value === "string" && (isolationCatalogFields as readonly string[]).includes(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.map(normalizeString).filter(Boolean) as string[];
  return normalized.length ? normalized : undefined;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeUserIsolationCatalogItem(value: unknown): CatalogItem | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);
  const label = normalizeString(record.label);
  const applicability = record.appliesTo && typeof record.appliesTo === "object"
    ? record.appliesTo as Record<string, unknown>
    : undefined;
  const field = normalizeString(applicability?.field);
  const route = normalizeString(applicability?.route);

  if (!id || !label) return undefined;
  if (record.owner !== "user") return undefined;
  if (record.category !== "isolation") return undefined;
  if (route) return undefined;
  if (field && !isIsolationCatalogField(field)) return undefined;

  return {
    id,
    owner: "user",
    category: "isolation",
    label,
    aliases: normalizeStringArray(record.aliases),
    appliesTo: field ? { field: field as IsolationCatalogField } : undefined,
    active: normalizeBoolean(record.active),
    favorite: normalizeBoolean(record.favorite),
    sortOrder: normalizeNumber(record.sortOrder),
    source: normalizeString(record.source),
    version: normalizeString(record.version),
  };
}

function normalizeStoredUserIsolationCatalog(value: unknown): StoredUserIsolationCatalog | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.items)) return undefined;
  return {
    version: 1,
    items: record.items.map(normalizeUserIsolationCatalogItem).filter(Boolean) as CatalogItem[],
  };
}

export function loadUserIsolationCatalogItems(storage = getDefaultCatalogStorage()): CatalogItem[] {
  if (!storage) return [];

  try {
    const stored = storage.getItem(USER_ISOLATION_CATALOG_STORAGE_KEY);
    if (!stored) return [];
    return normalizeStoredUserIsolationCatalog(JSON.parse(stored))?.items || [];
  } catch {
    return [];
  }
}

export function saveUserIsolationCatalogItems(items: CatalogItem[], storage = getDefaultCatalogStorage()) {
  if (!storage) return;

  const payload: StoredUserIsolationCatalog = {
    version: 1,
    items: items.map(normalizeUserIsolationCatalogItem).filter(Boolean) as CatalogItem[],
  };
  storage.setItem(USER_ISOLATION_CATALOG_STORAGE_KEY, JSON.stringify(payload));
}
