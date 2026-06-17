import type { WorkflowDefinition, WorkflowDiscipline, WorkflowScopeKind } from "../types";
import { protocolNodes } from "../protocol/nodes";
import { sharedIsolationWorkflow } from "./isolation";
import { operativeDirectRestorationWorkflow, sharedAnesthesiaWorkflowId } from "./operative";

export const endodonticRootWorkflowId = "endo.rct";
export const endodonticRootWorkflowVersion = "0.1.0";

export type WorkflowLauncherKind = "primary" | "sharedModule";
export type WorkflowLauncherAvailability = "ready" | "modelOnly";

export type WorkflowLauncherEntry = {
  workflowId: string;
  title: string;
  discipline: WorkflowDiscipline;
  kind: WorkflowLauncherKind;
  availability: WorkflowLauncherAvailability;
  statusLabel: string;
  launchLabel: string;
  summary: string;
  supportedScopes: WorkflowScopeKind[];
  definition?: WorkflowDefinition;
};

export const endodonticRootWorkflow: WorkflowDefinition = {
  workflowId: endodonticRootWorkflowId,
  version: endodonticRootWorkflowVersion,
  discipline: "endo",
  title: "Endodontic RCT",
  entryNodeIds: ["preop"],
  completionNodeIds: ["endodontic-pathway-complete"],
  supportedScopes: ["tooth", "canal", "procedure"],
  nodes: protocolNodes,
};

export const workflowLauncherEntries = [
  {
    workflowId: endodonticRootWorkflow.workflowId,
    title: endodonticRootWorkflow.title,
    discipline: endodonticRootWorkflow.discipline,
    kind: "primary",
    availability: "ready",
    statusLabel: "Ready",
    launchLabel: "Continue workflow",
    summary: "Current chairside state-machine workflow with local autosave and event-based notes.",
    supportedScopes: endodonticRootWorkflow.supportedScopes,
    definition: endodonticRootWorkflow,
  },
  {
    workflowId: operativeDirectRestorationWorkflow.workflowId,
    title: operativeDirectRestorationWorkflow.title,
    discipline: operativeDirectRestorationWorkflow.discipline,
    kind: "primary",
    availability: "modelOnly",
    statusLabel: "Model only",
    launchLabel: "UI not available",
    summary: "Workflow definition and surface scope model exist; chairside runner is not enabled yet.",
    supportedScopes: operativeDirectRestorationWorkflow.supportedScopes,
    definition: operativeDirectRestorationWorkflow,
  },
  {
    workflowId: sharedIsolationWorkflow.workflowId,
    title: sharedIsolationWorkflow.title,
    discipline: sharedIsolationWorkflow.discipline,
    kind: "sharedModule",
    availability: "ready",
    statusLabel: "Ready",
    launchLabel: "Open isolation workflow",
    summary: "Standalone shared module with event output and isolation capability status.",
    supportedScopes: sharedIsolationWorkflow.supportedScopes,
    definition: sharedIsolationWorkflow,
  },
  {
    workflowId: sharedAnesthesiaWorkflowId,
    title: "Anesthesia",
    discipline: "shared",
    kind: "sharedModule",
    availability: "modelOnly",
    statusLabel: "Model only",
    launchLabel: "Runner not available",
    summary: "Capability contract exists; dose, timing, adequacy response, and reassessment runner are not modeled yet.",
    supportedScopes: ["tooth", "quadrant", "sextant", "archSegment", "custom"],
  },
] as const satisfies readonly WorkflowLauncherEntry[];

export function getReadyWorkflowLauncherEntries(entries: readonly WorkflowLauncherEntry[] = workflowLauncherEntries) {
  return entries.filter((entry) => entry.availability === "ready");
}

export function getPrimaryWorkflowLauncherEntries(entries: readonly WorkflowLauncherEntry[] = workflowLauncherEntries) {
  return entries.filter((entry) => entry.kind === "primary");
}

export function getSharedModuleLauncherEntries(entries: readonly WorkflowLauncherEntry[] = workflowLauncherEntries) {
  return entries.filter((entry) => entry.kind === "sharedModule");
}
