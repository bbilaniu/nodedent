import React from "react";
import { endodonticRootWorkflowId } from "../workflow/registry";
import { EndodonticTargetPanel, type EndodonticTargetPanelProps } from "./EndodonticTargetPanel";

export function ActiveWorkflowTargetPanel({
  activeWorkflowId,
  endodonticProps,
}: {
  activeWorkflowId: string;
  endodonticProps: EndodonticTargetPanelProps;
}) {
  if (activeWorkflowId === endodonticRootWorkflowId) {
    return <EndodonticTargetPanel {...endodonticProps} />;
  }

  return null;
}
