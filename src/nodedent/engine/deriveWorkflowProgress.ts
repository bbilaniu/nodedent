import type { PrimaryWorkflowInstance } from "../types";

export type OverallWorkflowProgress =
  | "noWorkflowSelected"
  | "notStarted"
  | "inProgress"
  | "complete";

export const workflowLifecycleLabels: Record<PrimaryWorkflowInstance["status"], string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  complete: "Complete",
};

export const overallWorkflowProgressLabels: Record<OverallWorkflowProgress, string> = {
  noWorkflowSelected: "No workflow selected",
  notStarted: "Not started",
  inProgress: "In progress",
  complete: "Complete",
};

export function deriveOverallWorkflowProgress(
  instances: readonly Pick<PrimaryWorkflowInstance, "status">[]
): OverallWorkflowProgress {
  if (!instances.length) return "noWorkflowSelected";
  if (instances.every((instance) => instance.status === "complete")) return "complete";
  if (instances.every((instance) => instance.status === "notStarted")) return "notStarted";
  return "inProgress";
}
