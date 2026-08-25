import { seedAnesthesiaCatalogItems } from "./anesthesiaCatalog";
import type { CatalogItem } from "./catalogs";
import { getCatalogItems, mergeCatalogItems } from "./catalogs";
import { seedEndodonticCatalogItems } from "./endodonticCatalog";
import { seedIsolationCatalogItems } from "./isolationCatalog";

export type CatalogueSection = "Shared modules" | "Endodontics";

export type CatalogueDefinition = {
  key: string;
  section: CatalogueSection;
  group: string;
  title: string;
  description: string;
  category: string;
  route?: string;
  field: string;
  seedItems: CatalogItem[];
};

const allSeedItems = [
  ...seedAnesthesiaCatalogItems,
  ...seedIsolationCatalogItems,
  ...seedEndodonticCatalogItems,
];

function definition({
  section,
  group,
  title,
  description,
  category,
  route,
  field,
}: Omit<CatalogueDefinition, "key" | "seedItems">): CatalogueDefinition {
  const key = [category, route, field].filter(Boolean).join(".");
  return {
    key,
    section,
    group,
    title,
    description,
    category,
    route,
    field,
    seedItems: allSeedItems.filter((item) => (
      item.category === category &&
      item.appliesTo?.field === field &&
      item.appliesTo?.route === route
    )),
  };
}

export const catalogueDefinitions: CatalogueDefinition[] = [
  definition({ section: "Shared modules", group: "Injection anesthesia", title: "Agents", description: "Suggested injectable anesthetic names.", category: "anesthesia", route: "injection", field: "agents" }),
  definition({ section: "Shared modules", group: "Injection anesthesia", title: "Techniques", description: "Suggested injection techniques.", category: "anesthesia", route: "injection", field: "techniques" }),
  definition({ section: "Shared modules", group: "Injection anesthesia", title: "Dose units", description: "Units used to document anesthetic quantity.", category: "anesthesia", route: "injection", field: "doseUnits" }),
  definition({ section: "Shared modules", group: "Injection anesthesia", title: "Vasoconstrictors", description: "Vasoconstrictor documentation choices.", category: "anesthesia", route: "injection", field: "vasoconstrictors" }),
  definition({ section: "Shared modules", group: "Injection anesthesia", title: "Vasoconstrictor doses", description: "Suggested vasoconstrictor concentrations.", category: "anesthesia", route: "injection", field: "vasoconstrictorDoses" }),
  definition({ section: "Shared modules", group: "Topical anesthesia", title: "Agents", description: "Suggested topical anesthetic names.", category: "anesthesia", route: "topical", field: "agents" }),
  definition({ section: "Shared modules", group: "Topical anesthesia", title: "Application types", description: "Ways topical anesthetic was applied.", category: "anesthesia", route: "topical", field: "applicationTypes" }),
  definition({ section: "Shared modules", group: "Other anesthesia", title: "Route labels", description: "Labels for non-injection and non-topical routes.", category: "anesthesia", route: "other", field: "routeLabels" }),
  definition({ section: "Shared modules", group: "Other anesthesia", title: "Application types", description: "Application descriptions for other routes.", category: "anesthesia", route: "other", field: "applicationTypes" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Methods", description: "Suggested isolation methods.", category: "isolation", field: "methodLabels" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Support types", description: "Types of isolation support.", category: "isolation", field: "supportTypes" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Support phrases", description: "Phrases describing isolation support.", category: "isolation", field: "supportPhrases" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Region labels", description: "Suggested labels for isolated regions.", category: "isolation", field: "regionLabels" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Reasons", description: "Reasons for compromised or removed isolation.", category: "isolation", field: "reasons" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Notes", description: "Reusable isolation notes.", category: "isolation", field: "notes" }),
  definition({ section: "Shared modules", group: "Isolation", title: "Clamp codes", description: "Locally used clamp identifiers.", category: "isolation", field: "clampCodes" }),
  definition({ section: "Endodontics", group: "Obturation", title: "Root canal sealers", description: "Documentation suggestions for the sealer used during obturation. Custom text remains available in the workflow.", category: "endodontic", field: "sealers" }),
];

export function isRegisteredCatalogueApplicability(category: string, route?: string, field?: string) {
  return catalogueDefinitions.some((item) => (
    item.category === category &&
    (!field || item.field === field) &&
    (!route || item.route === route)
  ));
}

export function getCatalogueDefinitionItems(definitionItem: CatalogueDefinition, customItems: CatalogItem[], includeHidden = true) {
  const merged = mergeCatalogItems(definitionItem.seedItems, customItems);
  if (!includeHidden) {
    return getCatalogItems(merged, {
      category: definitionItem.category,
      route: definitionItem.route,
      field: definitionItem.field,
    });
  }

  return merged
    .filter((item) => (
      item.category === definitionItem.category &&
      (!item.appliesTo?.route || item.appliesTo.route === definitionItem.route) &&
      (!item.appliesTo?.field || item.appliesTo.field === definitionItem.field)
    ))
    .sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
      const sortDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
      return sortDiff || a.label.localeCompare(b.label);
    });
}

export function createUserCatalogueItem(definitionItem: CatalogueDefinition, label: string): CatalogItem {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `user.${definitionItem.key}.${slug}`,
    owner: "user",
    category: definitionItem.category,
    label: label.trim(),
    appliesTo: { route: definitionItem.route, field: definitionItem.field },
    active: true,
  };
}
