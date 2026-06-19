import React from "react";
import type { EndoCase } from "../types";
import { createOperativeSurfaceScope } from "../workflow/operative";
import { SectionCard, TextInput } from "./FormControls";

export type OperativeWorkflowSetupState = {
  tooth: string;
  surfaces: string;
  restorationIntent: string;
  material: string;
  shade: string;
};

export function OperativeWorkflowSetupPanel({
  caseData,
  setup,
  onSetupChange,
  className = "",
}: {
  caseData: EndoCase;
  setup: OperativeWorkflowSetupState;
  onSetupChange: (updates: Partial<OperativeWorkflowSetupState>) => void;
  className?: string;
}) {
  const tooth = setup.tooth || caseData.tooth;
  const surfaces = setup.surfaces.split(/[,\s]+/).map((surface) => surface.trim()).filter(Boolean);
  const scope = createOperativeSurfaceScope({
    tooth,
    surfaces,
    label: [tooth, surfaces.join("")].filter(Boolean).join(" "),
  });

  return (
    <SectionCard title="Operative setup" className={className}>
      <div className="grid gap-3">
        <p className="rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-xs leading-5 text-brand-slate">
          Capture the planned operative tooth and surface scope separately from endodontic canals. This setup is a workflow preview and does not record a restoration event yet.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Tooth" value={tooth} onChange={(value) => onSetupChange({ tooth: value })} placeholder="e.g., 36" />
          <TextInput label="Surfaces" value={setup.surfaces} onChange={(value) => onSetupChange({ surfaces: value })} placeholder="e.g., M O" />
          <TextInput label="Restoration intent" value={setup.restorationIntent} onChange={(value) => onSetupChange({ restorationIntent: value })} placeholder="e.g., direct restoration" />
          <TextInput label="Material" value={setup.material} onChange={(value) => onSetupChange({ material: value })} placeholder="optional" />
          <TextInput label="Shade" value={setup.shade} onChange={(value) => onSetupChange({ shade: value })} placeholder="optional" />
        </div>
        <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Current operative scope</p>
          <p className="mt-1 text-sm font-semibold text-brand-navy">{scope.label || "No tooth/surface scope yet"}</p>
        </div>
      </div>
    </SectionCard>
  );
}
