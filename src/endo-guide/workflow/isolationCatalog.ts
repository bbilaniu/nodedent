import type { CatalogItem } from "./catalogs";
import { getCatalogLabels, mergeCatalogItems } from "./catalogs";

export const isolationCatalogFields = [
  "methodLabels",
  "supportTypes",
  "supportPhrases",
  "regionLabels",
  "reasons",
  "notes",
  "clampCodes",
] as const;

export type IsolationCatalogField = typeof isolationCatalogFields[number];

export const isolationCatalogOwnership = {
  owner: "seed",
  clinicalUse: "documentationSuggestionsOnly",
  allowsCustomText: true,
  hasClampRecommendations: false,
  hasMethodRecommendations: false,
  hasOperativeReadinessRules: false,
} as const;

function slugifyCatalogValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isolationCatalogItem(
  field: IsolationCatalogField,
  label: string,
  sortOrder: number,
  metadata: Partial<Pick<CatalogItem, "aliases" | "favorite" | "source" | "version">> = {}
): CatalogItem {
  return {
    id: `isolation.${field}.${slugifyCatalogValue(label)}`,
    owner: "seed",
    category: "isolation",
    label,
    appliesTo: { field },
    active: true,
    sortOrder,
    ...metadata,
  };
}

export function createUserIsolationCatalogItem({
  field,
  label,
  aliases,
  favorite,
  active = true,
  sortOrder,
}: {
  field: IsolationCatalogField;
  label: string;
  aliases?: string[];
  favorite?: boolean;
  active?: boolean;
  sortOrder?: number;
}): CatalogItem {
  return {
    id: `user.isolation.${field}.${slugifyCatalogValue(label)}`,
    owner: "user",
    category: "isolation",
    label,
    aliases,
    appliesTo: { field },
    active,
    favorite,
    sortOrder,
  };
}

export function createUserIsolationCatalogOverride(item: CatalogItem, updates: Pick<CatalogItem, "active" | "favorite">): CatalogItem {
  return {
    ...item,
    owner: "user",
    active: updates.active,
    favorite: updates.favorite,
  };
}

export const seedIsolationCatalogItems: CatalogItem[] = [
  isolationCatalogItem("methodLabels", "Rubber dam", 10),
  isolationCatalogItem("methodLabels", "Split dam", 20),
  isolationCatalogItem("methodLabels", "Cotton roll isolation", 30),
  isolationCatalogItem("methodLabels", "Isovac isolation", 40),
  isolationCatalogItem("methodLabels", "Other isolation", 50),
  isolationCatalogItem("supportTypes", "Clamp", 10),
  isolationCatalogItem("supportTypes", "Wedge", 20),
  isolationCatalogItem("supportTypes", "Ligature", 30),
  isolationCatalogItem("supportTypes", "Other support", 40),
  isolationCatalogItem("supportPhrases", "Clamp placed", 10),
  isolationCatalogItem("supportPhrases", "Ligature placed", 20),
  isolationCatalogItem("supportPhrases", "Wedge support used", 30),
  isolationCatalogItem("regionLabels", "Quadrant", 10),
  isolationCatalogItem("regionLabels", "Sextant", 20),
  isolationCatalogItem("regionLabels", "Arch segment", 30),
  isolationCatalogItem("regionLabels", "Custom region", 40),
  isolationCatalogItem("reasons", "Saliva contamination", 10),
  isolationCatalogItem("reasons", "Dam displaced", 20),
  isolationCatalogItem("reasons", "Isolation removed for assessment", 30),
  isolationCatalogItem("notes", "Isolation stable", 10),
  isolationCatalogItem("notes", "Isolation monitored throughout", 20),
];

export function getIsolationCatalogItems(customItems: CatalogItem[] = []): CatalogItem[] {
  return mergeCatalogItems(seedIsolationCatalogItems, customItems);
}

export function getIsolationCatalogOptions(
  field: IsolationCatalogField,
  customItems: CatalogItem[] = []
): string[] {
  return getCatalogLabels(getIsolationCatalogItems(customItems), {
    category: "isolation",
    field,
  });
}
