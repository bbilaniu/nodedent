import { operativeDirectRestorationWorkflowId } from "./operative";
import { endodonticRootWorkflowId } from "./registry";

export type WorkflowTargetPanelKind = "endodontic" | "operative" | "none";

export function getWorkflowTargetPanelKind(workflowId?: string | null): WorkflowTargetPanelKind {
  if (workflowId === endodonticRootWorkflowId) return "endodontic";
  if (workflowId === operativeDirectRestorationWorkflowId) return "operative";
  return "none";
}

export function workflowHasEndodonticTargetPanel(workflowId?: string | null) {
  return getWorkflowTargetPanelKind(workflowId) === "endodontic";
}

export function workflowHasOperativeTargetPanel(workflowId?: string | null) {
  return getWorkflowTargetPanelKind(workflowId) === "operative";
}
