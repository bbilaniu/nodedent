import type { CatalogItem } from "./catalogs";
import { getCatalogLabels, mergeCatalogItems } from "./catalogs";

export const endodonticCatalogFields = ["sealers"] as const;

export type EndodonticCatalogField = typeof endodonticCatalogFields[number];

function slugifyCatalogValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function endodonticCatalogItem(id: string, label: string, sortOrder: number): CatalogItem {
  return {
    id: `endodontic.sealers.${id}`,
    owner: "seed",
    category: "endodontic",
    label,
    appliesTo: { field: "sealers" },
    active: true,
    sortOrder,
    source: "Clinician-supplied catalogue list for issue 88",
    version: "2026-08-23",
  };
}

export const seedEndodonticCatalogItems: CatalogItem[] = [
  endodonticCatalogItem("kerr-sealapex", "Kerr® Sealapex™ (Calcium Hydroxide Root Canal Sealer)", 10),
  endodonticCatalogItem("kerr-pulp-canal-sealer", "Kerr® Pulp Canal Sealer (Zinc Oxide Eugenol Root Canal Sealer)", 20),
  endodonticCatalogItem("angelus-mta-fillapex", "Angelus® MTA Fillapex® (Mineral Trioxide Aggregate Root Canal Sealer)", 30),
];

export function createUserEndodonticCatalogItem({
  label,
  aliases,
  favorite,
  active = true,
  sortOrder,
}: {
  label: string;
  aliases?: string[];
  favorite?: boolean;
  active?: boolean;
  sortOrder?: number;
}): CatalogItem {
  return {
    id: `user.endodontic.sealers.${slugifyCatalogValue(label)}`,
    owner: "user",
    category: "endodontic",
    label,
    aliases,
    appliesTo: { field: "sealers" },
    active,
    favorite,
    sortOrder,
  };
}

export function getEndodonticCatalogItems(customItems: CatalogItem[] = []) {
  return mergeCatalogItems(seedEndodonticCatalogItems, customItems);
}

export function getEndodonticSealerCatalogOptions(customItems: CatalogItem[] = []) {
  return getCatalogLabels(getEndodonticCatalogItems(customItems), {
    category: "endodontic",
    field: "sealers",
  });
}
