import React, { useState } from "react";
import type { ClinicalEvent, EmbeddedWorkflowLaunch, EndoCase, WorkflowDefinition } from "../types";
import type { AnesthesiaEventDetails, AnesthesiaEventType } from "../workflow/anesthesia";
import { sharedAnesthesiaWorkflow, sharedAnesthesiaWorkflowId } from "../workflow/anesthesia";
import type { AnesthesiaEventOptions } from "../workflow/anesthesiaForm";
import type { CatalogItem } from "../workflow/catalogs";
import type { IsolationEventDetails, IsolationEventType } from "../workflow/isolation";
import { sharedIsolationWorkflow, sharedIsolationWorkflowId } from "../workflow/isolation";
import type { RadiologyEventDetails } from "../workflow/radiology";
import { sharedRadiologyWorkflow, sharedRadiologyWorkflowId } from "../workflow/radiology";
import { AnesthesiaWorkflowRunner } from "./AnesthesiaWorkflowRunner";
import { IsolationWorkflowRunner } from "./IsolationWorkflowRunner";
import { RadiologyWorkflowRunner } from "./RadiologyWorkflowRunner";
import { ClinicalDataNotice } from "./ClinicalDataNotice";
import { cx, semanticActionButton, semanticStatusSurface } from "./uiStyles";
import { AccessibleDialog } from "./AccessibleDialog";

function getWorkflowForLaunch(launch: EmbeddedWorkflowLaunch): WorkflowDefinition | undefined {
  if (launch.workflowId === sharedIsolationWorkflowId) return sharedIsolationWorkflow;
  if (launch.workflowId === sharedAnesthesiaWorkflowId) return sharedAnesthesiaWorkflow;
  if (launch.workflowId === sharedRadiologyWorkflowId) return sharedRadiologyWorkflow;
  return undefined;
}

export function SharedWorkflowRunnerModal({
  launch,
  caseData,
  parentNodeTitle,
  parentWorkflowRunId,
  latestAnesthesiaEvent,
  latestIsolationEvent,
  latestRadiologyEvent,
  userAnesthesiaCatalogItems = [],
  onUserAnesthesiaCatalogItemsChange,
  userIsolationCatalogItems = [],
  onUserIsolationCatalogItemsChange,
  onClose,
  onRecordAnesthesiaEvent,
  onRecordIsolationEvent,
  onRecordRadiologyEvent,
  onOpenCatalogue,
}: {
  launch: EmbeddedWorkflowLaunch;
  caseData: EndoCase;
  parentNodeTitle: string;
  parentWorkflowRunId: string;
  latestAnesthesiaEvent?: ClinicalEvent;
  latestIsolationEvent?: ClinicalEvent;
  latestRadiologyEvent?: ClinicalEvent;
  userAnesthesiaCatalogItems?: CatalogItem[];
  onUserAnesthesiaCatalogItemsChange?: (items: CatalogItem[]) => void;
  userIsolationCatalogItems?: CatalogItem[];
  onUserIsolationCatalogItemsChange?: (items: CatalogItem[]) => void;
  onClose: () => void;
  onOpenCatalogue?: () => void;
  onRecordAnesthesiaEvent: (
    eventType: AnesthesiaEventType,
    details: AnesthesiaEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string } & AnesthesiaEventOptions
  ) => void;
  onRecordIsolationEvent: (
    eventType: IsolationEventType,
    details: IsolationEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string }
  ) => void;
  onRecordRadiologyEvent: (
    details: RadiologyEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string }
  ) => void;
}) {
  const workflow = getWorkflowForLaunch(launch);
  const [hasUnconfirmedChanges, setHasUnconfirmedChanges] = useState(false);

  function requestClose() {
    if (hasUnconfirmedChanges && !window.confirm("Discard unrecorded changes in this shared workflow?")) return;
    onClose();
  }

  function requestOpenCatalogue() {
    if (hasUnconfirmedChanges && !window.confirm("Open the Catalogue and discard unrecorded changes in this shared workflow?")) return;
    setHasUnconfirmedChanges(false);
    onOpenCatalogue?.();
  }

  const recordAnesthesiaEvent: typeof onRecordAnesthesiaEvent = (...args) => {
    onRecordAnesthesiaEvent(...args);
    setHasUnconfirmedChanges(false);
  };
  const recordIsolationEvent: typeof onRecordIsolationEvent = (...args) => {
    onRecordIsolationEvent(...args);
    setHasUnconfirmedChanges(false);
  };
  const recordRadiologyEvent: typeof onRecordRadiologyEvent = (...args) => {
    onRecordRadiologyEvent(...args);
    setHasUnconfirmedChanges(false);
  };

  return (
    <AccessibleDialog
      labelledBy="shared-workflow-dialog-title"
      overlayVariant="raised"
      panelClassName="max-w-3xl"
      onRequestClose={requestClose}
    >
      <div
        onChangeCapture={(event) => {
          if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) {
            setHasUnconfirmedChanges(true);
          }
        }}
        onClickCapture={(event) => {
          if (!(event.target instanceof Element)) return;
          const button = event.target.closest("button");
          if (button && !button.matches("[data-dialog-dismiss], [data-clinical-record-action]")) setHasUnconfirmedChanges(true);
        }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Embedded workflow</p>
            <h2 id="shared-workflow-dialog-title" className="mt-1 text-2xl font-bold text-brand-navy">{workflow?.title || "Shared workflow"}</h2>
            <p className="mt-1 text-sm text-brand-slate">Parent step: <strong>{parentNodeTitle}</strong></p>
          </div>
          <button type="button" data-dialog-initial-focus data-dialog-dismiss onClick={requestClose} className={semanticActionButton.secondary}>
            Close
          </button>
        </div>

        <ClinicalDataNotice compact />

        <div className="mt-4">
          {launch.workflowId === sharedIsolationWorkflowId ? (
            <IsolationWorkflowRunner
              launch={launch}
              caseData={caseData}
              parentWorkflowRunId={parentWorkflowRunId}
              latestIsolationEvent={latestIsolationEvent}
              userCatalogItems={userIsolationCatalogItems}
              onUserCatalogItemsChange={onUserIsolationCatalogItemsChange}
              onRecordIsolationEvent={recordIsolationEvent}
              onOpenCatalogue={onOpenCatalogue ? requestOpenCatalogue : undefined}
            />
          ) : launch.workflowId === sharedAnesthesiaWorkflowId ? (
            <AnesthesiaWorkflowRunner
              launch={launch}
              caseData={caseData}
              parentWorkflowRunId={parentWorkflowRunId}
              latestAnesthesiaEvent={latestAnesthesiaEvent}
              userCatalogItems={userAnesthesiaCatalogItems}
              onUserCatalogItemsChange={onUserAnesthesiaCatalogItemsChange}
              onRecordAnesthesiaEvent={recordAnesthesiaEvent}
              onOpenCatalogue={onOpenCatalogue ? requestOpenCatalogue : undefined}
            />
          ) : launch.workflowId === sharedRadiologyWorkflowId ? (
            <RadiologyWorkflowRunner
              launch={launch}
              caseData={caseData}
              parentWorkflowRunId={parentWorkflowRunId}
              latestRadiologyEvent={latestRadiologyEvent}
              onRecordRadiologyEvent={recordRadiologyEvent}
            />
          ) : (
            <div role="status" className={cx(semanticStatusSurface.attention, "p-4 text-sm leading-6")}>
              This shared workflow is not available in the embedded runner yet.
            </div>
          )}
        </div>
      </div>
    </AccessibleDialog>
  );
}
