import React from "react";
import type { CaseSetupFocusTarget } from "../types";
import type { AppointmentWorkflowMap } from "../workflow/workflowMap";
import { formatWorkflowMapTarget } from "../workflow/workflowMap";
import { cx, panelSurface, sectionText, statusBadge, workspaceSurface } from "./uiStyles";

export type WorkflowMapActionHandlers = {
  onContinueEndodonticWorkflow: () => void;
  onOpenPrimaryWorkflowSetup: (workflowId: string, workflowInstanceId?: string) => void;
  onAddOperativeInstance?: () => void;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: () => void;
  onOpenIsolationWorkflow: () => void;
  onOpenRadiologyWorkflow: () => void;
};

export type WorkflowMapPanelAction = {
  id: string;
  label: string;
  disabled: boolean;
  onClick?: () => void;
};

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

export function getAppointmentWorkflowMapActions(
  map: AppointmentWorkflowMap,
  handlers: WorkflowMapActionHandlers
): {
  instanceActions: Record<string, WorkflowMapPanelAction>;
  moduleActions: Record<string, WorkflowMapPanelAction>;
  definitionActions: Record<string, WorkflowMapPanelAction>;
} {
  const instanceActions = Object.fromEntries(map.workflowInstances.map((instance) => {
    if (instance.workflowType === "endo.rct") {
      return [instance.id, {
        id: instance.id,
        label: "Enter workflow",
        disabled: false,
        onClick: handlers.onContinueEndodonticWorkflow,
      }];
    }

    if (instance.workflowType === "operative.direct-restoration") {
      return [instance.id, {
        id: instance.id,
        label: "Enter workflow",
        disabled: false,
        onClick: () => handlers.onOpenPrimaryWorkflowSetup("operative.direct-restoration", instance.id),
      }];
    }

    return [instance.id, { id: instance.id, label: "Model only", disabled: true }];
  }));

  const moduleActions = Object.fromEntries(map.sharedModules.map((module) => {
    if (module.moduleType === "shared.diagnostics") {
      return [module.id, {
        id: module.id,
        label: "Open diagnosis",
        disabled: false,
        onClick: () => handlers.onOpenCaseSetupStatus("diagnosis"),
      }];
    }

    if (module.moduleType === "shared.radiology") {
      return [module.id, {
        id: module.id,
        label: "Open radiology workflow",
        disabled: false,
        onClick: handlers.onOpenRadiologyWorkflow,
      }];
    }

    if (module.moduleType === "shared.anesthesia") {
      return [module.id, {
        id: module.id,
        label: "Open anesthesia workflow",
        disabled: false,
        onClick: handlers.onOpenAnesthesiaWorkflow,
      }];
    }

    if (module.moduleType === "shared.isolation") {
      return [module.id, {
        id: module.id,
        label: "Open isolation workflow",
        disabled: false,
        onClick: handlers.onOpenIsolationWorkflow,
      }];
    }

    return [module.id, { id: module.id, label: "Model only", disabled: true }];
  }));

  const definitionActions = Object.fromEntries(map.workflowDefinitions.map((definition) => {
    if (definition.workflowType === "endo.rct") {
      return [definition.workflowType, {
        id: definition.workflowType,
        label: "Enter workflow",
        disabled: false,
        onClick: handlers.onContinueEndodonticWorkflow,
      }];
    }

    if (definition.workflowType === "operative.direct-restoration") {
      return [definition.workflowType, {
        id: definition.workflowType,
        label: "Add operative instance",
        disabled: false,
        onClick: handlers.onAddOperativeInstance || (() => handlers.onOpenPrimaryWorkflowSetup("operative.direct-restoration")),
      }];
    }

    return [definition.workflowType, { id: definition.workflowType, label: "Model only", disabled: true }];
  }));

  return { instanceActions, moduleActions, definitionActions };
}

export function AppointmentWorkflowMapPanel({
  map,
  actions,
}: {
  map: AppointmentWorkflowMap;
  actions: ReturnType<typeof getAppointmentWorkflowMapActions>;
}) {
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Workflow instances</p>
            <button
              type="button"
              onClick={actions.definitionActions["operative.direct-restoration"]?.onClick}
              disabled={actions.definitionActions["operative.direct-restoration"]?.disabled}
              className="rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-xs font-semibold text-brand-navy transition hover:bg-brand-blue-light/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add operative instance
            </button>
          </div>
          <div className="mt-2 grid gap-2">
            {map.workflowInstances.length ? (
              map.workflowInstances.map((instance) => {
                const action = actions.instanceActions[instance.id];
                return (
                  <div key={instance.id} className={workspaceSurface.statusTile}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-brand-navy">{instance.label}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-slate">Target: {formatWorkflowMapTarget(instance.target)}</p>
                      </div>
                      <span className={cx(statusBadge.base, statusClass(instance.statusLabel))}>{instance.statusLabel}</span>
                    </div>
                    <button
                      type="button"
                      onClick={action?.onClick}
                      disabled={!action || action.disabled}
                      className="mt-3 rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate"
                    >
                      {action?.label || "Model only"}
                    </button>
                  </div>
                );
              })
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
            {map.sharedModules.map((module) => {
              const action = actions.moduleActions[module.id];
              return (
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
                  <button
                    type="button"
                    onClick={action?.onClick}
                    disabled={!action || action.disabled}
                    className="mt-3 rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {action?.label || "Model only"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modelOnlyDefinitions.length ? (
        <div className="mt-4 border-t border-brand-light-node pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Seeded future workflow types</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {modelOnlyDefinitions.map((definition) => {
              const action = actions.definitionActions[definition.workflowType];
              return (
                <button
                  key={definition.workflowType}
                  type="button"
                  onClick={action?.onClick}
                  disabled={!action || action.disabled}
                  className={cx(statusBadge.base, modelStatusClass(definition.status), "disabled:cursor-not-allowed")}
                >
                  {definition.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
