import type { AnesthesiaCatalogField } from "../workflow/anesthesiaCatalog";
import type { AnesthesiaRoute } from "../workflow/anesthesia";
import { isAnesthesiaRoute } from "../workflow/anesthesia";
import type { CatalogItem } from "../workflow/catalogs";

export const USER_ANESTHESIA_CATALOG_STORAGE_KEY = "nodedent.userCatalog.sharedAnesthesia.v1";

type CatalogStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type StoredUserAnesthesiaCatalog = {
  version: 1;
  items: CatalogItem[];
};

const anesthesiaCatalogFields = [
  "agents",
  "techniques",
  "applicationTypes",
  "doseUnits",
  "vasoconstrictors",
  "vasoconstrictorDoses",
  "routeLabels",
] as const satisfies readonly AnesthesiaCatalogField[];

function getDefaultCatalogStorage(): CatalogStorage | undefined {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

function isAnesthesiaCatalogField(value: unknown): value is AnesthesiaCatalogField {
  return typeof value === "string" && (anesthesiaCatalogFields as readonly string[]).includes(value);
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

function normalizeUserAnesthesiaCatalogItem(value: unknown): CatalogItem | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);
  const label = normalizeString(record.label);
  const route = record.appliesTo && typeof record.appliesTo === "object"
    ? normalizeString((record.appliesTo as Record<string, unknown>).route)
    : undefined;
  const field = record.appliesTo && typeof record.appliesTo === "object"
    ? normalizeString((record.appliesTo as Record<string, unknown>).field)
    : undefined;

  if (!id || !label) return undefined;
  if (record.owner !== "user") return undefined;
  if (record.category !== "anesthesia") return undefined;
  if (route && !isAnesthesiaRoute(route)) return undefined;
  if (field && !isAnesthesiaCatalogField(field)) return undefined;

  return {
    id,
    owner: "user",
    category: "anesthesia",
    label,
    aliases: normalizeStringArray(record.aliases),
    appliesTo: route || field ? { route: route as AnesthesiaRoute | undefined, field: field as AnesthesiaCatalogField | undefined } : undefined,
    active: normalizeBoolean(record.active),
    favorite: normalizeBoolean(record.favorite),
    sortOrder: normalizeNumber(record.sortOrder),
    source: normalizeString(record.source),
    version: normalizeString(record.version),
  };
}

function normalizeStoredUserAnesthesiaCatalog(value: unknown): StoredUserAnesthesiaCatalog | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.items)) return undefined;
  return {
    version: 1,
    items: record.items.map(normalizeUserAnesthesiaCatalogItem).filter(Boolean) as CatalogItem[],
  };
}

export function loadUserAnesthesiaCatalogItems(storage = getDefaultCatalogStorage()): CatalogItem[] {
  if (!storage) return [];

  try {
    const stored = storage.getItem(USER_ANESTHESIA_CATALOG_STORAGE_KEY);
    if (!stored) return [];
    return normalizeStoredUserAnesthesiaCatalog(JSON.parse(stored))?.items || [];
  } catch {
    return [];
  }
}

export function saveUserAnesthesiaCatalogItems(items: CatalogItem[], storage = getDefaultCatalogStorage()) {
  if (!storage) return;

  const payload: StoredUserAnesthesiaCatalog = {
    version: 1,
    items: items.map(normalizeUserAnesthesiaCatalogItem).filter(Boolean) as CatalogItem[],
  };
  storage.setItem(USER_ANESTHESIA_CATALOG_STORAGE_KEY, JSON.stringify(payload));
}
