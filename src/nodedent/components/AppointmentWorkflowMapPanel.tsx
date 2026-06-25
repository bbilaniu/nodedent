import React from "react";
import type { AppointmentWorkflowMap } from "../workflow/workflowMap";
import { formatWorkflowMapTarget } from "../workflow/workflowMap";
import { cx, panelSurface, sectionText, statusBadge, workspaceSurface } from "./uiStyles";

function statusClass(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("ready") || normalized.includes("recorded") || normalized.includes("completed")) return statusBadge.ready;
  if (normalized.includes("review")) return "border-amber-200 bg-amber-50 text-amber-900";
  return statusBadge.neutral;
}

function modelStatusClass(status: string) {
  return status === "ready" ? statusBadge.ready : statusBadge.neutral;
}

function compactList(items: readonly string[] = []) {
  return items.length ? items.join(", ") : "none";
}

export function AppointmentWorkflowMapPanel({ map }: { map: AppointmentWorkflowMap }) {
  const primaryDefinitions = map.workflowDefinitions.filter((definition) => definition.category === "primary");
  const modelOnlyDefinitions = primaryDefinitions.filter((definition) => definition.status === "modelOnly");

  return (
    <section className={panelSurface.cardPadded}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={sectionText.titleSmall}>Appointment workflow map</h3>
          <p className={sectionText.descriptionSmall}>Current appointment composition</p>
        </div>
        <span className={cx(statusBadge.base, statusBadge.neutral)}>
          {map.workflowInstances.length} instances
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Workflow instances</p>
          <div className="mt-2 grid gap-2">
            {map.workflowInstances.length ? (
              map.workflowInstances.map((instance) => (
                <div key={instance.id} className={workspaceSurface.statusTile}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-brand-navy">{instance.label}</p>
                      <p className="mt-1 text-xs leading-5 text-brand-slate">Target: {formatWorkflowMapTarget(instance.target)}</p>
                    </div>
                    <span className={cx(statusBadge.base, statusClass(instance.statusLabel))}>{instance.statusLabel}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={workspaceSurface.statusTile}>
                <p className="text-sm font-semibold text-brand-slate">No scoped workflow instances yet.</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Shared modules</p>
          <div className="mt-2 grid gap-2">
            {map.sharedModules.map((module) => (
              <div key={module.id} className={workspaceSurface.statusTile}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-brand-navy">{module.label}</p>
                    <p className="mt-1 text-xs leading-5 text-brand-slate">Scope: {formatWorkflowMapTarget(module.scope)}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">
                      Used by: {compactList(module.usedBy)}
                    </p>
                  </div>
                  <span className={cx(statusBadge.base, statusClass(module.statusLabel))}>{module.statusLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modelOnlyDefinitions.length ? (
        <div className="mt-4 border-t border-brand-light-node pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Seeded future workflow types</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {modelOnlyDefinitions.map((definition) => (
              <span key={definition.workflowType} className={cx(statusBadge.base, modelStatusClass(definition.status))}>
                {definition.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
