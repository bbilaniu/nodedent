import React from "react";
import { getWorkflowTargetPanelKind } from "../workflow/targetPanels";
import { EndodonticTargetPanel, type EndodonticTargetPanelProps } from "./EndodonticTargetPanel";
import { OperativeWorkflowSetupPanel, type OperativeWorkflowSetupState } from "./OperativeWorkflowSetupPanel";

export function ActiveWorkflowTargetPanel({
  activeWorkflowId,
  endodonticProps,
  operativeProps,
}: {
  activeWorkflowId: string;
  endodonticProps: EndodonticTargetPanelProps;
  operativeProps: {
    caseData: EndodonticTargetPanelProps["caseData"];
    setup: OperativeWorkflowSetupState;
    onSetupChange: (updates: Partial<OperativeWorkflowSetupState>) => void;
  };
}) {
  if (getWorkflowTargetPanelKind(activeWorkflowId) === "endodontic") {
    return <EndodonticTargetPanel {...endodonticProps} />;
  }

  if (getWorkflowTargetPanelKind(activeWorkflowId) === "operative") {
    return <OperativeWorkflowSetupPanel {...operativeProps} />;
  }

  return null;
}
