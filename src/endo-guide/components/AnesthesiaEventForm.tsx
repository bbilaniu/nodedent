import React, { useEffect, useRef, useState } from "react";
import type { ClinicalEvent } from "../types";
import type { AnesthesiaAdequacyResponse, AnesthesiaEventDetails, AnesthesiaEventType, AnesthesiaRoute } from "../workflow/anesthesia";
import { anesthesiaEventTypes } from "../workflow/anesthesia";
import { getAnesthesiaCatalogOptions } from "../workflow/anesthesiaCatalog";
import type { CatalogItem } from "../workflow/catalogs";
import {
  anesthesiaAdministrationActionFromLabel,
  anesthesiaAdministrationActionLabels,
  anesthesiaAdministrationActionOptions,
  anesthesiaAssessmentLabels,
  anesthesiaRouteFromLabel,
  anesthesiaRouteOptions,
  buildAnesthesiaEventFromForm,
  buildAnesthesiaFormState,
  canSubmitAnesthesiaForm,
  defaultAnesthesiaFormState,
  getAnesthesiaRouteActionLabel,
  getAnesthesiaRouteSelectionLabel,
  isAnesthesiaAssessmentReassessment,
} from "../workflow/anesthesiaForm";
import type { AnesthesiaAdministrationAction, AnesthesiaFormState, AnesthesiaMode } from "../workflow/anesthesiaForm";
import type { AnesthesiaEventOptions } from "../workflow/anesthesiaForm";
import { SelectInput, TextInput } from "./FormControls";

export function AnesthesiaEventForm({
  tooth,
  latestEvent,
  defaultAction = anesthesiaEventTypes.administered,
  userCatalogItems = [],
  onRecordEvent,
}: {
  tooth: string;
  latestEvent?: ClinicalEvent;
  defaultAction?: AnesthesiaAdministrationAction;
  userCatalogItems?: CatalogItem[];
  onRecordEvent: (eventType: AnesthesiaEventType, details: AnesthesiaEventDetails, options?: AnesthesiaEventOptions) => void;
}) {
  const [mode, setMode] = useState<AnesthesiaMode>("administration");
  const [form, setForm] = useState<AnesthesiaFormState>(() => defaultAnesthesiaFormState(tooth, defaultAction));
  const previousToothRef = useRef(tooth);
  const modeIsAssessment = mode === "assessment";
  const assessmentNeedsReassessment = isAnesthesiaAssessmentReassessment(mode, form);
  const canSubmit = canSubmitAnesthesiaForm(mode, form);
  const showReassessAfter = mode === "assessment" && form.response === "adequate";
  const routeIsInjection = mode === "administration" && form.route === "injection";
  const routeIsTopical = mode === "administration" && form.route === "topical";
  const routeIsOther = mode === "administration" && form.route === "other";
  const agentSuggestions = getAnesthesiaCatalogOptions(form.route, "agents", userCatalogItems);
  const techniqueSuggestions = getAnesthesiaCatalogOptions(form.route, "techniques", userCatalogItems);
  const applicationTypeSuggestions = getAnesthesiaCatalogOptions(form.route, "applicationTypes", userCatalogItems);
  const doseUnitSuggestions = getAnesthesiaCatalogOptions(form.route, "doseUnits", userCatalogItems);
  const vasoconstrictorSuggestions = getAnesthesiaCatalogOptions(form.route, "vasoconstrictors", userCatalogItems);
  const vasoconstrictorDoseSuggestions = getAnesthesiaCatalogOptions(form.route, "vasoconstrictorDoses", userCatalogItems);
  const routeLabelSuggestions = getAnesthesiaCatalogOptions(form.route, "routeLabels", userCatalogItems);

  useEffect(() => {
    const previousTooth = previousToothRef.current;
    previousToothRef.current = tooth;
    setForm((prev) => ({
      ...prev,
      targetTeeth: !prev.targetTeeth || prev.targetTeeth === previousTooth ? tooth || "" : prev.targetTeeth,
    }));
  }, [tooth]);

  function updateForm(updates: Partial<AnesthesiaFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function resetForm(action: AnesthesiaAdministrationAction = defaultAction) {
    setMode("administration");
    setForm(defaultAnesthesiaFormState(tooth, action));
  }

  function selectRoute(route: AnesthesiaRoute) {
    setMode("administration");
    setForm((prev) => ({
      ...prev,
      route,
      action: prev.action === anesthesiaEventTypes.topUpGiven ? anesthesiaEventTypes.topUpGiven : defaultAction,
      response: "notAssessed",
    }));
  }

  function prepareMode(nextMode: AnesthesiaMode) {
    setMode(nextMode);
    const action = nextMode === "administration" ? defaultAction : anesthesiaEventTypes.adequacyConfirmed;
    const nextForm = buildAnesthesiaFormState(tooth, action, latestEvent);
    setForm(nextMode === "assessment" ? { ...nextForm, action, response: "notAssessed", note: "" } : nextForm);
  }

  function submitEvent() {
    const event = buildAnesthesiaEventFromForm(mode, form);
    if (!event) return;
    onRecordEvent(event.eventType, event.details, event.options);
    resetForm();
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="Record anesthesia administration"
          onClick={() => prepareMode("administration")}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${mode === "administration" ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-blue-light/20"}`}
        >
          Record administration
        </button>
        <button
          type="button"
          aria-label="Record anesthesia assessment"
          onClick={() => prepareMode("assessment")}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${mode === "assessment" ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-mint/40 bg-brand-mint/10 text-brand-navy hover:bg-brand-mint/20"}`}
        >
          Record assessment
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {mode === "administration" ? (
          <div>
            <p className="mb-2 text-xs font-medium text-brand-slate">Local anesthesia route</p>
            <div className="flex flex-wrap gap-2">
              {anesthesiaRouteOptions.map((routeLabel) => {
                const route = anesthesiaRouteFromLabel(routeLabel);
                return (
                  <button
                    key={route}
                    type="button"
                    onClick={() => selectRoute(route)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${form.route === route ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"}`}
                  >
                    {getAnesthesiaRouteSelectionLabel(route)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-medium text-brand-slate">Assessment</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(anesthesiaAssessmentLabels).map(([response, label]) => (
                <button
                  key={response}
                  type="button"
                  onClick={() => updateForm({ response: response as AnesthesiaAdequacyResponse })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${form.response === response ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "administration" ? (
          <SelectInput
            label="Purpose"
            value={anesthesiaAdministrationActionLabels[form.action === anesthesiaEventTypes.topUpGiven ? anesthesiaEventTypes.topUpGiven : anesthesiaEventTypes.administered]}
            onChange={(value) => updateForm({ action: anesthesiaAdministrationActionFromLabel(value) })}
            options={anesthesiaAdministrationActionOptions}
          />
        ) : null}
        <TextInput label="Target teeth" value={form.targetTeeth} onChange={(value) => updateForm({ targetTeeth: value })} placeholder="e.g., 36 or 34 35 36" />
        <TextInput label="Region label" value={form.regionLabel} onChange={(value) => updateForm({ regionLabel: value })} placeholder="e.g., Q3, lower left, custom" />
        {routeIsInjection ? (
          <>
            <TextInput label="Technique" value={form.technique} onChange={(value) => updateForm({ technique: value })} placeholder="optional" suggestions={techniqueSuggestions} />
            <TextInput label="Site" value={form.site} onChange={(value) => updateForm({ site: value })} placeholder="optional" />
            <TextInput label="Agent" value={form.agentLabel} onChange={(value) => updateForm({ agentLabel: value })} placeholder="optional" suggestions={agentSuggestions} />
            <TextInput label="Dose" value={form.dose} onChange={(value) => updateForm({ dose: value })} placeholder="optional" inputMode="decimal" />
            <TextInput label="Dose unit" value={form.doseUnit} onChange={(value) => updateForm({ doseUnit: value })} placeholder="e.g., mL, carpule" suggestions={doseUnitSuggestions} />
            <TextInput label="Vasoconstrictor" value={form.vasoconstrictor} onChange={(value) => updateForm({ vasoconstrictor: value })} placeholder="optional" suggestions={vasoconstrictorSuggestions} />
            <TextInput label="Vasoconstrictor dose" value={form.vasoconstrictorDose} onChange={(value) => updateForm({ vasoconstrictorDose: value })} placeholder="e.g., 1:100K epinephrine/adrenaline" suggestions={vasoconstrictorDoseSuggestions} />
            <TextInput label="Time administered" value={form.administeredAt} onChange={(value) => updateForm({ administeredAt: value })} placeholder="e.g., 09:55" />
          </>
        ) : null}
        {routeIsTopical ? (
          <>
            <TextInput label="Application type" value={form.applicationType} onChange={(value) => updateForm({ applicationType: value })} placeholder="optional" suggestions={applicationTypeSuggestions} />
            <TextInput label="Site" value={form.site} onChange={(value) => updateForm({ site: value })} placeholder="optional" />
            <TextInput label="Agent" value={form.agentLabel} onChange={(value) => updateForm({ agentLabel: value })} placeholder="optional" suggestions={agentSuggestions} />
            <TextInput label="Time administered" value={form.administeredAt} onChange={(value) => updateForm({ administeredAt: value })} placeholder="e.g., 09:55" />
          </>
        ) : null}
        {routeIsOther ? (
          <>
            <TextInput label="Route / application" value={form.routeLabel} onChange={(value) => updateForm({ routeLabel: value })} placeholder="optional" suggestions={routeLabelSuggestions} />
            <TextInput label="Application details" value={form.applicationType} onChange={(value) => updateForm({ applicationType: value })} placeholder="optional" suggestions={applicationTypeSuggestions} />
            <TextInput label="Site" value={form.site} onChange={(value) => updateForm({ site: value })} placeholder="optional" />
          </>
        ) : null}
        {routeIsTopical || routeIsOther || modeIsAssessment ? (
          <TextInput
            label={assessmentNeedsReassessment ? "Reason" : "Notes"}
            value={form.note}
            onChange={(value) => updateForm({ note: value })}
            placeholder={assessmentNeedsReassessment ? "e.g., sensitivity returned" : "optional"}
          />
        ) : null}
        {showReassessAfter ? (
          <TextInput
            label="Reassess after"
            value={form.expiresAt}
            onChange={(value) => updateForm({ expiresAt: value })}
            type="datetime-local"
            helperText="Optional clinician-entered documentation only. NodeDent does not calculate this from anesthetic details."
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={submitEvent}
        disabled={!canSubmit}
        className={`mt-3 rounded-xl border px-4 py-2 text-sm font-semibold transition ${canSubmit ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "cursor-not-allowed border-brand-light-node bg-white text-brand-slate"}`}
      >
        {mode === "administration" ? getAnesthesiaRouteActionLabel(form.route) : "Record assessment"}
      </button>
    </>
  );
}
