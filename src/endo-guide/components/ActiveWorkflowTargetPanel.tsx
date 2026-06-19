import React from "react";
import { getWorkflowTargetPanelKind } from "../workflow/targetPanels";
import { EndodonticTargetPanel, type EndodonticTargetPanelProps } from "./EndodonticTargetPanel";

export function ActiveWorkflowTargetPanel({
  activeWorkflowId,
  endodonticProps,
}: {
  activeWorkflowId: string;
  endodonticProps: EndodonticTargetPanelProps;
}) {
  if (getWorkflowTargetPanelKind(activeWorkflowId) === "endodontic") {
    return <EndodonticTargetPanel {...endodonticProps} />;
  }

  return null;
}
