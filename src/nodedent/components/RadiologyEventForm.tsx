import React, { useState } from "react";
import type { RadiologyEventDetails, RadiologyModality, RadiologyRegionKind } from "../workflow/radiology";
import { radiologyModalities, radiologyRegionKinds } from "../workflow/radiology";
import { TextInput } from "./FormControls";
import { cx, panelActionButton } from "./uiStyles";

type RadiologyReviewFormState = {
  modalities: RadiologyModality[];
  scopeKind: RadiologyRegionKind;
  tooth: string;
  teeth: string;
  regionLabel: string;
  procedureId: string;
  otherModalityLabel: string;
  imageDate: string;
  sourceLabel: string;
  limitations: string;
  notes: string;
};

const modalityLabels = {
  pa: "PA",
  bw: "BW",
  cbct: "CBCT",
  other: "Other",
} as const satisfies Record<RadiologyModality, string>;

const scopeLabels = {
  tooth: "Current tooth",
  teeth: "Multiple teeth",
  quadrant: "Quadrant",
  archSegment: "Arch segment",
  procedure: "Procedure",
  custom: "Custom region",
} as const satisfies Record<RadiologyRegionKind, string>;

function splitTeethInput(value: string) {
  return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
}

function createDefaultRadiologyReviewForm(tooth: string): RadiologyReviewFormState {
  return {
    modalities: [],
    scopeKind: "tooth",
    tooth,
    teeth: "",
    regionLabel: "",
    procedureId: "",
    otherModalityLabel: "",
    imageDate: "",
    sourceLabel: "",
    limitations: "",
    notes: "",
  };
}

function buildRadiologyEventDetails(form: RadiologyReviewFormState, fallbackTooth: string): RadiologyEventDetails {
  const teeth = splitTeethInput(form.teeth);
  return {
    modalities: form.modalities,
    otherModalityLabel: form.otherModalityLabel.trim() || undefined,
    tooth: form.scopeKind === "tooth" ? form.tooth.trim() || fallbackTooth || undefined : undefined,
    teeth: form.scopeKind === "teeth" && teeth.length ? teeth : undefined,
    regionKind: form.scopeKind,
    regionLabel: form.scopeKind !== "tooth" && form.scopeKind !== "procedure" ? form.regionLabel.trim() || undefined : undefined,
    procedureId: form.scopeKind === "procedure" ? form.procedureId.trim() || undefined : undefined,
    imageDate: form.imageDate.trim() || undefined,
    sourceLabel: form.sourceLabel.trim() || undefined,
    limitations: form.limitations.trim() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function RadiologyEventForm({
  tooth,
  onRecordEvent,
}: {
  tooth: string;
  onRecordEvent?: (details: RadiologyEventDetails) => void;
}) {
  const [form, setForm] = useState<RadiologyReviewFormState>(() => createDefaultRadiologyReviewForm(tooth));
  const canRecordReview = Boolean(onRecordEvent && form.modalities.length);

  function updateForm(updates: Partial<RadiologyReviewFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function toggleModality(modality: RadiologyModality) {
    setForm((prev) => ({
      ...prev,
      modalities: prev.modalities.includes(modality)
        ? prev.modalities.filter((item) => item !== modality)
        : [...prev.modalities, modality],
    }));
  }

  function recordReview() {
    if (!canRecordReview || !onRecordEvent) return;
    onRecordEvent(buildRadiologyEventDetails(form, tooth));
    setForm((prev) => ({ ...createDefaultRadiologyReviewForm(tooth), scopeKind: prev.scopeKind, tooth: prev.tooth || tooth }));
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate">Shared radiology event</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">Record explicit image review without implying diagnostic adequacy.</p>
        </div>
        <button
          type="button"
          onClick={recordReview}
          disabled={!canRecordReview}
          className={cx(panelActionButton.primary, "disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-brand-light-slate disabled:text-brand-slate")}
        >
          Record radiograph review
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-brand-slate">Modalities reviewed</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {radiologyModalities.map((modality) => (
              <button
                key={modality}
                type="button"
                onClick={() => toggleModality(modality)}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  form.modalities.includes(modality)
                    ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep"
                    : "border-brand-light-node bg-brand-light-slate text-brand-navy hover:bg-brand-light-node",
                )}
              >
                {modalityLabels[modality]}
              </button>
            ))}
          </div>
        </div>
        {form.modalities.includes("other") ? (
          <TextInput label="Other modality label" value={form.otherModalityLabel} onChange={(value) => updateForm({ otherModalityLabel: value })} placeholder="e.g., pano" />
        ) : null}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-slate">Review scope</span>
          <select
            value={form.scopeKind}
            onChange={(event) => updateForm({ scopeKind: event.target.value as RadiologyRegionKind })}
            className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
          >
            {radiologyRegionKinds.map((scopeKind) => <option key={scopeKind} value={scopeKind}>{scopeLabels[scopeKind]}</option>)}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {form.scopeKind === "tooth" ? (
            <TextInput label="Tooth" value={form.tooth} onChange={(value) => updateForm({ tooth: value })} placeholder={tooth || "optional"} />
          ) : null}
          {form.scopeKind === "teeth" ? (
            <TextInput label="Teeth" value={form.teeth} onChange={(value) => updateForm({ teeth: value })} placeholder="e.g., 34 35 36 37" />
          ) : null}
          {form.scopeKind === "procedure" ? (
            <TextInput label="Procedure ID" value={form.procedureId} onChange={(value) => updateForm({ procedureId: value })} placeholder="optional" />
          ) : null}
          {form.scopeKind !== "tooth" && form.scopeKind !== "teeth" && form.scopeKind !== "procedure" ? (
            <TextInput label="Region label" value={form.regionLabel} onChange={(value) => updateForm({ regionLabel: value })} placeholder="e.g., Q3, upper anterior, custom" />
          ) : null}
          <TextInput label="Image date" value={form.imageDate} onChange={(value) => updateForm({ imageDate: value })} placeholder="optional" type="date" />
          <TextInput label="Source" value={form.sourceLabel} onChange={(value) => updateForm({ sourceLabel: value })} placeholder="e.g., current visit, outside images" />
          <TextInput label="Limitations" value={form.limitations} onChange={(value) => updateForm({ limitations: value })} placeholder="optional" />
          <TextInput label="Notes" value={form.notes} onChange={(value) => updateForm({ notes: value })} placeholder="optional" />
        </div>
      </div>
    </div>
  );
}
