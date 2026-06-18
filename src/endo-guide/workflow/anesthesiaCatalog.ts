import type { AnesthesiaRoute } from "./anesthesia";
import type { CatalogItem } from "./catalogs";
import { getCatalogLabels, mergeCatalogItems } from "./catalogs";

export type AnesthesiaCatalogField =
  | "agents"
  | "techniques"
  | "applicationTypes"
  | "doseUnits"
  | "vasoconstrictors"
  | "vasoconstrictorDoses"
  | "routeLabels";

export const anesthesiaCatalogOwnership = {
  owner: "seed",
  clinicalUse: "documentationSuggestionsOnly",
  allowsCustomText: true,
  hasDoseDefaults: false,
  hasProductRecommendations: false,
} as const;

function anesthesiaCatalogItem(
  field: AnesthesiaCatalogField,
  route: AnesthesiaRoute,
  label: string,
  sortOrder: number,
  metadata: Partial<Pick<CatalogItem, "aliases" | "favorite" | "source" | "version">> = {}
): CatalogItem {
  return {
    id: `anesthesia.${route}.${field}.${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    owner: "seed",
    category: "anesthesia",
    label,
    appliesTo: { route, field },
    active: true,
    sortOrder,
    ...metadata,
  };
}

export const seedAnesthesiaCatalogItems: CatalogItem[] = [
  anesthesiaCatalogItem("techniques", "injection", "Infiltration", 10),
  anesthesiaCatalogItem("techniques", "injection", "Block", 20),
  anesthesiaCatalogItem("techniques", "injection", "Intraligamentary / PDL", 30, { aliases: ["PDL"] }),
  anesthesiaCatalogItem("techniques", "injection", "Intraosseous", 40),
  anesthesiaCatalogItem("techniques", "injection", "Intrapulpal", 50),
  anesthesiaCatalogItem("techniques", "injection", "Other injection technique", 60),
  anesthesiaCatalogItem("doseUnits", "injection", "mL", 10),
  anesthesiaCatalogItem("doseUnits", "injection", "carpule(s)", 20, { aliases: ["carpule", "carpules"] }),
  anesthesiaCatalogItem("vasoconstrictors", "injection", "With vasoconstrictor", 10),
  anesthesiaCatalogItem("vasoconstrictors", "injection", "Without vasoconstrictor", 20),
  anesthesiaCatalogItem("vasoconstrictors", "injection", "None documented", 30),
  anesthesiaCatalogItem("vasoconstrictorDoses", "injection", "1:100K epinephrine/adrenaline", 10),
  anesthesiaCatalogItem("vasoconstrictorDoses", "injection", "1:200K epinephrine/adrenaline", 20),
  anesthesiaCatalogItem("applicationTypes", "topical", "Topical application", 10),
  anesthesiaCatalogItem("applicationTypes", "topical", "Gel", 20),
  anesthesiaCatalogItem("applicationTypes", "topical", "Liquid", 30),
  anesthesiaCatalogItem("applicationTypes", "topical", "Spray", 40),
  anesthesiaCatalogItem("applicationTypes", "topical", "Other topical application", 50),
  anesthesiaCatalogItem("applicationTypes", "other", "Other application", 10),
  anesthesiaCatalogItem("routeLabels", "other", "Inhaled", 10),
  anesthesiaCatalogItem("routeLabels", "other", "Other", 20),
];

export function getAnesthesiaCatalogItems(customItems: CatalogItem[] = []): CatalogItem[] {
  return mergeCatalogItems(seedAnesthesiaCatalogItems, customItems);
}

export function getAnesthesiaCatalogOptions(
  route: AnesthesiaRoute,
  field: AnesthesiaCatalogField,
  customItems: CatalogItem[] = []
): string[] {
  return getCatalogLabels(getAnesthesiaCatalogItems(customItems), {
    category: "anesthesia",
    route,
    field,
  });
}
