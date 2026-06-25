import type { WorkflowDefinition, WorkflowDiscipline, WorkflowScopeKind } from "../types";
import { protocolNodes } from "../protocol/nodes";
import { sharedAnesthesiaWorkflow } from "./anesthesia";
import { sharedIsolationWorkflow } from "./isolation";
import { operativeDirectRestorationWorkflow } from "./operative";
import { sharedRadiologyWorkflow } from "./radiology";

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
    launchLabel: "Enter workflow",
    summary: "Current chairside state-machine workflow with local autosave and event-based notes.",
    supportedScopes: endodonticRootWorkflow.supportedScopes,
    definition: endodonticRootWorkflow,
  },
  {
    workflowId: operativeDirectRestorationWorkflow.workflowId,
    title: operativeDirectRestorationWorkflow.title,
    discipline: operativeDirectRestorationWorkflow.discipline,
    kind: "primary",
    availability: "ready",
    statusLabel: "Ready",
    launchLabel: "Enter workflow",
    summary: "Surface-scoped direct restoration runner with shared readiness, event-backed setup, and restoration record output.",
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
    workflowId: sharedAnesthesiaWorkflow.workflowId,
    title: sharedAnesthesiaWorkflow.title,
    discipline: sharedAnesthesiaWorkflow.discipline,
    kind: "sharedModule",
    availability: "ready",
    statusLabel: "Ready",
    launchLabel: "Open anesthesia workflow",
    summary: "Embedded shared module records route-aware administration, top-up, assessment, and reassessment events.",
    supportedScopes: sharedAnesthesiaWorkflow.supportedScopes,
    definition: sharedAnesthesiaWorkflow,
  },
  {
    workflowId: sharedRadiologyWorkflow.workflowId,
    title: sharedRadiologyWorkflow.title,
    discipline: sharedRadiologyWorkflow.discipline,
    kind: "sharedModule",
    availability: "ready",
    statusLabel: "Ready",
    launchLabel: "Open radiology workflow",
    summary: "Shared module records scoped radiograph review without inferring image adequacy or recommendations.",
    supportedScopes: sharedRadiologyWorkflow.supportedScopes,
    definition: sharedRadiologyWorkflow,
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
