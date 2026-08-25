import React, { useEffect, useRef, useState } from "react";
import type { ClinicalEvent } from "../types";
import type { AnesthesiaAdequacyResponse, AnesthesiaEventDetails, AnesthesiaEventType, AnesthesiaRoute } from "../workflow/anesthesia";
import { anesthesiaEventTypes } from "../workflow/anesthesia";
import { buildUserAnesthesiaCatalogItemsFromForm, getAnesthesiaCatalogOptions } from "../workflow/anesthesiaCatalog";
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
  getAnesthesiaAdministrationRecordLabel,
  getAnesthesiaRouteSelectionLabel,
  hasAnesthesiaTargetScope,
  isAnesthesiaAssessmentReassessment,
} from "../workflow/anesthesiaForm";
import type { AnesthesiaAdministrationAction, AnesthesiaFormState, AnesthesiaMode } from "../workflow/anesthesiaForm";
import type { AnesthesiaEventOptions } from "../workflow/anesthesiaForm";
import { getCurrentTimeString, isCompleteTime24 } from "../workflow/dateTime";
import { SelectInput, TextInput } from "./FormControls";
import { cx, panelActionButton, semanticActionButton, semanticChoiceControl } from "./uiStyles";

export function AnesthesiaEventForm({
  tooth,
  latestEvent,
  initialMode = "administration",
  defaultAction = anesthesiaEventTypes.administered,
  userCatalogItems = [],
  onSaveCatalogItems,
  onManageShortcuts,
  onRecordEvent,
}: {
  tooth: string;
  latestEvent?: ClinicalEvent;
  initialMode?: AnesthesiaMode;
  defaultAction?: AnesthesiaAdministrationAction;
  userCatalogItems?: CatalogItem[];
  onSaveCatalogItems?: (items: CatalogItem[]) => void;
  onManageShortcuts?: () => void;
  onRecordEvent: (eventType: AnesthesiaEventType, details: AnesthesiaEventDetails, options?: AnesthesiaEventOptions) => void;
}) {
  const [mode, setMode] = useState<AnesthesiaMode>(initialMode);
  const [form, setForm] = useState<AnesthesiaFormState>(() => initialMode === "assessment"
    ? { ...buildAnesthesiaFormState(tooth, anesthesiaEventTypes.adequacyConfirmed, latestEvent), response: "notAssessed", note: "" }
    : defaultAnesthesiaFormState(tooth, defaultAction));
  const previousToothRef = useRef(tooth);
  const modeIsAssessment = mode === "assessment";
  const assessmentNeedsReassessment = isAnesthesiaAssessmentReassessment(mode, form);
  const hasTargetScope = hasAnesthesiaTargetScope(form);
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
  const shortcutItems = mode === "administration" ? buildUserAnesthesiaCatalogItemsFromForm(form) : [];
  const canSaveShortcuts = Boolean(onSaveCatalogItems && shortcutItems.length);
  const administeredAtInvalid = Boolean(form.administeredAt && !isCompleteTime24(form.administeredAt));
  const administrationAction = form.action === anesthesiaEventTypes.topUpGiven ? anesthesiaEventTypes.topUpGiven : anesthesiaEventTypes.administered;
  const recordActionLabel = mode === "administration"
    ? getAnesthesiaAdministrationRecordLabel(form.route, administrationAction)
    : "Add anesthesia assessment";
  const nextStepLabel = mode === "administration"
    ? "Assess anesthesia adequacy"
    : form.response === "adequate"
      ? "Anesthesia status recorded"
      : form.response === "notAdequate"
        ? "Anesthesia needs reassessment"
        : "Select an assessment result";

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

  function saveShortcuts() {
    if (!canSaveShortcuts) return;
    onSaveCatalogItems?.(shortcutItems);
  }

  const timeAdministeredInput = (
    <div>
      <label htmlFor="anesthesia-administered-at" className="mb-1 block text-xs font-medium text-brand-slate">Time administered</label>
      <div className="flex flex-wrap gap-2">
        <input
          id="anesthesia-administered-at"
          type="time"
          value={form.administeredAt}
          onChange={(event) => updateForm({ administeredAt: event.target.value })}
          className={`min-w-36 flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${administeredAtInvalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-brand-light-node focus:border-brand-blue focus:ring-brand-blue-light/20"}`}
        />
        <button type="button" onClick={() => updateForm({ administeredAt: getCurrentTimeString() })} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-xs font-semibold text-brand-navy transition hover:bg-brand-light-slate">
          Set to now
        </button>
        <button type="button" onClick={() => updateForm({ administeredAt: "" })} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-xs font-semibold text-brand-navy transition hover:bg-brand-light-slate">
          Clear time
        </button>
      </div>
      {administeredAtInvalid ? <p role="status" className="mt-1 text-xs text-red-800">Enter time as HH:mm or clear it.</p> : null}
    </div>
  );

  return (
    <>
      <div className="mt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-slate">Entry type</p>
        <div role="group" aria-label="Anesthesia entry type" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={mode === "administration"}
            onClick={() => prepareMode("administration")}
            className={mode === "administration" ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
          >
            <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, mode === "administration" ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
            Administration
          </button>
          <button
            type="button"
            aria-pressed={mode === "assessment"}
            onClick={() => prepareMode("assessment")}
            className={mode === "assessment" ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
          >
            <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, mode === "assessment" ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
            Assessment
          </button>
        </div>
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
                    aria-pressed={form.route === route}
                    onClick={() => selectRoute(route)}
                    className={form.route === route ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
                  >
                    <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, form.route === route ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
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
                  aria-pressed={form.response === response}
                  onClick={() => updateForm({ response: response as AnesthesiaAdequacyResponse })}
                  className={form.response === response ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
                >
                  <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, form.response === response ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
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
            {timeAdministeredInput}
          </>
        ) : null}
        {routeIsTopical ? (
          <>
            <TextInput label="Application type" value={form.applicationType} onChange={(value) => updateForm({ applicationType: value })} placeholder="optional" suggestions={applicationTypeSuggestions} />
            <TextInput label="Site" value={form.site} onChange={(value) => updateForm({ site: value })} placeholder="optional" />
            <TextInput label="Agent" value={form.agentLabel} onChange={(value) => updateForm({ agentLabel: value })} placeholder="optional" suggestions={agentSuggestions} />
            {timeAdministeredInput}
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
      {!hasTargetScope ? <p role="status" className="mt-2 text-xs leading-5 text-amber-900">Enter at least one target tooth or a region label before recording anesthesia.</p> : null}
      <div className="mt-5 border-t border-brand-light-node pt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-slate">Record to current visit</p>
        <button
          type="button"
          data-clinical-record-action="anesthesia"
          onClick={submitEvent}
          disabled={!canSubmit}
          className={semanticActionButton.primaryDecision}
        >
          <span className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg leading-none text-white group-disabled:border-brand-light-node group-disabled:bg-white group-disabled:text-brand-slate">+</span>
            <span>
              <span className="block">{recordActionLabel}</span>
              <span className="mt-1 block text-xs font-normal text-white/80 group-disabled:text-brand-slate">Next: {nextStepLabel}</span>
            </span>
          </span>
        </button>
      </div>
      {mode === "administration" && (onSaveCatalogItems || onManageShortcuts) ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Reusable Catalogue</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">These actions save patient-independent preferences only. They do not record a clinical entry.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onSaveCatalogItems ? (
              <button
                type="button"
                onClick={saveShortcuts}
                disabled={!canSaveShortcuts}
                className={panelActionButton.secondary}
              >
                Add entered values to Catalogue
              </button>
            ) : null}
            {onManageShortcuts ? (
              <button
                type="button"
                onClick={onManageShortcuts}
                className={panelActionButton.secondary}
              >
                Manage Catalogue
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-900">Do not save chart numbers, patient facts, or identifiers in a Catalogue entry.</p>
        </div>
      ) : null}
    </>
  );
}
