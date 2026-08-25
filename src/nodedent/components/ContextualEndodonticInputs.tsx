import React, { useState } from "react";
import type { CanalRecord, EndoCase, EndodonticFieldId, ProtocolNode } from "../types";
import { getSuggestedLengths, isBlank, isPositiveMeasurement } from "../engine/measurements";
import { getCapabilityStatus } from "../workflow/selectors";
import { sharedAnesthesiaWorkflowId } from "../workflow/anesthesia";
import { sharedRadiologyWorkflowId } from "../workflow/radiology";
import { SelectInput, TextInput } from "./FormControls";
import { panelActionButton } from "./uiStyles";
import { sharedModuleEntryNodeId } from "./sharedModuleUi";

const positiveMeasurementFields = new Set<EndodonticFieldId>([
  "estimatedChamberDepth",
  "estimatedWorkingLength",
  "availableTreatmentSpace",
  "eal0",
  "patencyLength",
  "shapingLength",
]);

const fieldLabels: Record<EndodonticFieldId, string> = {
  estimatedChamberDepth: "Chamber depth",
  estimatedWorkingLength: "Estimated WL",
  fileTerminalLength: "10C terminal length",
  availableTreatmentSpace: "Available treatment space",
  referencePoint: "Reference point",
  eal0: "EAL 0",
  patencyLength: "Patency length",
  shapingLength: "Shaping length",
  wlRadiographStatus: "WL PA",
  finalShape: "Final shaping file",
  obturationGauge: "Obturation gauge",
  masterCone: "Master cone",
  sealerLabel: "Sealer used",
  coneFitRadiograph: "Cone fit PA",
  dryingStatus: "Drying status",
};

const fieldPlaceholders: Partial<Record<EndodonticFieldId, string>> = {
  estimatedChamberDepth: "mm",
  estimatedWorkingLength: "mm",
  fileTerminalLength: "if stopped short",
  availableTreatmentSpace: "mm",
  referencePoint: "e.g., MB cusp",
  eal0: "mm",
  patencyLength: "mm",
  shapingLength: "mm",
  finalShape: "e.g., 30/.04 or PTN X2 25/.06",
  obturationGauge: "e.g., 30",
  masterCone: "e.g., 30/.04",
  sealerLabel: "Select or enter the sealer used",
};

function getFieldValue(fieldId: EndodonticFieldId, caseData: EndoCase, activeCanal?: CanalRecord | null) {
  if (fieldId === "estimatedChamberDepth") return caseData.preOp?.estimatedChamberDepth || "";
  return String(activeCanal?.[fieldId as keyof CanalRecord] || "");
}

function isContextualFieldInvalid(fieldId: EndodonticFieldId, nodeId: string, value: string) {
  if (fieldId === "fileTerminalLength") return false;
  if (fieldId === "finalShape" && nodeId === "increase-shaping-gauge") return false;
  if (fieldId === "obturationGauge" && nodeId === "gauge-obturation-larger") return false;
  if (positiveMeasurementFields.has(fieldId)) return !isPositiveMeasurement(value);
  return isBlank(value);
}

export function ContextualEndodonticInputs({
  currentNode,
  caseData,
  activeCanal,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplyEalDerivedLengths,
  onOpenAnesthesiaWorkflow,
  onOpenRadiologyWorkflow,
  sealerSuggestions = [],
  onAddSealerToCatalogue,
  onOpenCatalogue,
}: {
  currentNode: ProtocolNode;
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplyEalDerivedLengths: () => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  sealerSuggestions?: string[];
  onAddSealerToCatalogue?: (label: string) => boolean;
  onOpenCatalogue?: () => void;
}) {
  const [catalogueMessage, setCatalogueMessage] = useState("");
  const fieldIds = currentNode.contextualFieldIds || [];
  const hasRadiologyCall = currentNode.moduleCalls?.some((call) => call.workflowId === sharedRadiologyWorkflowId);
  const hasAnesthesiaCall = currentNode.moduleCalls?.some((call) => call.workflowId === sharedAnesthesiaWorkflowId);
  if (!fieldIds.length && !hasRadiologyCall && !hasAnesthesiaCall) return null;

  const suggestedLengths = getSuggestedLengths(activeCanal);
  const radiographStatus = hasRadiologyCall
    ? getCapabilityStatus(caseData, "radiographs.reviewed", caseData.tooth ? { kind: "tooth", tooth: caseData.tooth } : undefined)
    : null;
  const anesthesiaStatus = hasAnesthesiaCall
    ? getCapabilityStatus(caseData, "anesthesia.adequate", caseData.tooth ? { kind: "tooth", tooth: caseData.tooth } : undefined)
    : null;

  function updateField(fieldId: EndodonticFieldId, value: string) {
    if (fieldId === "estimatedChamberDepth") onUpdatePreOp(fieldId, value);
    else onUpdateActiveCanal(fieldId, value);
  }

  return (
    <section className="mt-4 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4" aria-labelledby="contextual-inputs-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 id="contextual-inputs-title" className="text-sm font-bold text-brand-navy">Record for this step</h4>
          <p className="mt-1 text-xs leading-5 text-brand-slate">
            Values update the existing {activeCanal?.name ? <><strong>{activeCanal.name}</strong> canal record</> : "case record"} and remain available in the full measurement panel.
          </p>
        </div>
      </div>

      {hasRadiologyCall ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
          <p className="text-xs font-semibold text-brand-navy">Radiograph review</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">{radiographStatus?.summary || "Record a tooth-scoped radiograph review for this step."}</p>
          <button type="button" onClick={() => onOpenRadiologyWorkflow()} className={`${panelActionButton.secondary} mt-2`}>
            {radiographStatus?.satisfied ? "Review radiograph record" : "Record radiograph review"}
          </button>
        </div>
      ) : null}

      {hasAnesthesiaCall && anesthesiaStatus ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
          <p className="text-xs font-semibold text-brand-navy">Anesthesia requirement</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">{anesthesiaStatus.summary}</p>
          <button
            type="button"
            onClick={() => onOpenAnesthesiaWorkflow(sharedModuleEntryNodeId("anesthesia", anesthesiaStatus))}
            className={`${panelActionButton.secondary} mt-2`}
          >
            Review anesthesia record
          </button>
        </div>
      ) : null}

      {fieldIds.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {fieldIds.map((fieldId) => {
            const value = getFieldValue(fieldId, caseData, activeCanal);
            const invalid = isContextualFieldInvalid(fieldId, currentNode.id, value);

            if (fieldId === "wlRadiographStatus" || fieldId === "coneFitRadiograph") {
              return (
                <SelectInput
                  key={fieldId}
                  label={fieldLabels[fieldId]}
                  value={value}
                  onChange={(nextValue) => updateField(fieldId, nextValue)}
                  options={["", "acceptable", "short", "long", "not taken"]}
                  invalid={invalid}
                />
              );
            }

            if (fieldId === "dryingStatus") {
              return (
                <SelectInput
                  key={fieldId}
                  label={fieldLabels[fieldId]}
                  value={value}
                  onChange={(nextValue) => updateField(fieldId, nextValue)}
                  options={["", "dry", "slightly damp", "wet", "persistent wet"]}
                  invalid={invalid}
                />
              );
            }

            return (
              <TextInput
                key={fieldId}
                label={fieldLabels[fieldId]}
                value={value}
                onChange={(nextValue) => updateField(fieldId, nextValue)}
                placeholder={fieldPlaceholders[fieldId]}
                inputMode={positiveMeasurementFields.has(fieldId) || fieldId === "fileTerminalLength" || fieldId === "obturationGauge" ? "decimal" : undefined}
                invalid={invalid}
                suggestions={fieldId === "sealerLabel" ? sealerSuggestions : []}
                rightLabel={fieldId === "patencyLength" && suggestedLengths.patency
                  ? `Suggested: ${suggestedLengths.patency} mm`
                  : fieldId === "shapingLength" && suggestedLengths.shaping
                    ? `Suggested: ${suggestedLengths.shaping} mm`
                    : null}
              />
            );
          })}
        </div>
      ) : null}

      {fieldIds.includes("sealerLabel") && activeCanal ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
          <p className="text-xs leading-5 text-brand-slate">Catalogue entries are patient-independent preferences. Adding this value does not record sealer application or add a clinical event.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onAddSealerToCatalogue ? (
              <button
                type="button"
                disabled={!activeCanal.sealerLabel?.trim()}
                onClick={() => {
                  const added = onAddSealerToCatalogue(activeCanal.sealerLabel || "");
                  setCatalogueMessage(added ? "Added to the local Catalogue." : "That value is already available in the Catalogue.");
                }}
                className={`${panelActionButton.secondary} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Add entered value to Catalogue
              </button>
            ) : null}
            {onOpenCatalogue ? <button type="button" onClick={onOpenCatalogue} className={panelActionButton.secondary}>Manage Catalogue</button> : null}
          </div>
          {catalogueMessage ? <p role="status" className="mt-2 text-xs font-semibold text-brand-navy">{catalogueMessage}</p> : null}
        </div>
      ) : null}

      {fieldIds.includes("eal0") ? (
        <button type="button" onClick={onApplyEalDerivedLengths} className={`${panelActionButton.secondary} mt-3 w-full`}>
          Use EAL ±1 {suggestedLengths.patency && suggestedLengths.shaping ? `(patency ${suggestedLengths.patency}, shaping ${suggestedLengths.shaping})` : ""}
        </button>
      ) : null}
    </section>
  );
}
