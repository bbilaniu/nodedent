export type CatalogOwner = "appCore" | "seed" | "user" | "clinic" | "template";

export type CatalogApplicability = {
  route?: string;
  field?: string;
};

export type CatalogItem = {
  id: string;
  owner: CatalogOwner;
  category: string;
  label: string;
  aliases?: string[];
  appliesTo?: CatalogApplicability;
  active?: boolean;
  favorite?: boolean;
  sortOrder?: number;
  source?: string;
  version?: string;
};

export type CatalogQuery = {
  category: string;
  route?: string;
  field?: string;
  includeAliases?: boolean;
};

export const catalogOwnerPrecedence: Record<CatalogOwner, number> = {
  appCore: 0,
  seed: 1,
  template: 2,
  clinic: 3,
  user: 4,
};

function normalizeCatalogKey(value: string) {
  return value.trim().toLowerCase();
}

function itemMatchesQuery(item: CatalogItem, query: CatalogQuery) {
  if (item.category !== query.category) return false;
  if (item.active === false) return false;
  if (query.route && item.appliesTo?.route && item.appliesTo.route !== query.route) return false;
  if (query.field && item.appliesTo?.field && item.appliesTo.field !== query.field) return false;
  return true;
}

function shouldReplaceCatalogItem(current: CatalogItem, candidate: CatalogItem) {
  const currentRank = catalogOwnerPrecedence[current.owner];
  const candidateRank = catalogOwnerPrecedence[candidate.owner];
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  return (candidate.sortOrder ?? Number.MAX_SAFE_INTEGER) < (current.sortOrder ?? Number.MAX_SAFE_INTEGER);
}

export function mergeCatalogItems(...layers: CatalogItem[][]): CatalogItem[] {
  const merged = new Map<string, CatalogItem>();

  for (const item of layers.flat()) {
    const key = item.id || normalizeCatalogKey(`${item.category}:${item.label}`);
    const current = merged.get(key);
    if (!current || shouldReplaceCatalogItem(current, item)) merged.set(key, item);
  }

  return [...merged.values()];
}

export function getCatalogItems(items: CatalogItem[], query: CatalogQuery): CatalogItem[] {
  return items
    .filter((item) => itemMatchesQuery(item, query))
    .sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
      const sortDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (sortDiff !== 0) return sortDiff;
      return a.label.localeCompare(b.label);
    });
}

export function getCatalogLabels(items: CatalogItem[], query: CatalogQuery): string[] {
  const labels = new Set<string>();

  for (const item of getCatalogItems(items, query)) {
    labels.add(item.label);
    if (query.includeAliases) {
      for (const alias of item.aliases || []) labels.add(alias);
    }
  }

  return [...labels];
}

