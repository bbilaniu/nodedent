import type { AnesthesiaRoute } from "./anesthesia";

export type AnesthesiaCatalogField =
  | "agents"
  | "techniques"
  | "applicationTypes"
  | "doseUnits"
  | "vasoconstrictors"
  | "routeLabels";

export type AnesthesiaRouteCatalog = Record<AnesthesiaCatalogField, string[]>;

export const anesthesiaCatalogOwnership = {
  owner: "seed",
  clinicalUse: "documentationSuggestionsOnly",
  allowsCustomText: true,
  hasDoseDefaults: false,
  hasProductRecommendations: false,
} as const;

export const anesthesiaCatalog = {
  injection: {
    agents: [],
    techniques: [
      "Infiltration",
      "Block",
      "Intraligamentary / PDL",
      "Intraosseous",
      "Intrapulpal",
      "Other injection technique",
    ],
    applicationTypes: [],
    doseUnits: ["mL", "carpule(s)"],
    vasoconstrictors: ["With vasoconstrictor", "Without vasoconstrictor", "None documented"],
    routeLabels: [],
  },
  topical: {
    agents: [],
    techniques: [],
    applicationTypes: ["Topical application", "Gel", "Liquid", "Spray", "Other topical application"],
    doseUnits: [],
    vasoconstrictors: [],
    routeLabels: [],
  },
  other: {
    agents: [],
    techniques: [],
    applicationTypes: ["Other application"],
    doseUnits: [],
    vasoconstrictors: [],
    routeLabels: ["Inhaled", "Other"],
  },
} as const satisfies Record<AnesthesiaRoute, AnesthesiaRouteCatalog>;

export function getAnesthesiaCatalogOptions(route: AnesthesiaRoute, field: AnesthesiaCatalogField): string[] {
  return [...anesthesiaCatalog[route][field]];
}
