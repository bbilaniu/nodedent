import React from "react";
import type { CanalRecord, CaseSetupFocusTarget, EndoCase } from "../types";
import { getCanalStatus, statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { priorCanalStatusLabels } from "../engine/resume";
import { protocolNodes } from "../protocol/nodes";
import { operativeDirectRestorationWorkflowId, type OperativeWorkflowSetupState } from "../workflow/operative";
import { endodonticRootWorkflowId } from "../workflow/registry";
import { normalizeWorkflowInstances } from "../workflow/workflowInstances";
import { CaseSetupStatusPanel } from "./CaseSetupStatusPanel";
import { ClinicalDataNotice } from "./ClinicalDataNotice";
import { panelActionButton } from "./uiStyles";

export function CaseSetupPage({
  caseData,
  activeCanal,
  activeWorkflowId,
  currentNodeId,
  operativeSetup,
  onClose,
  onUpdateCase,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplySuggestedCaseStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  onOpenRadiologyWorkflow,
  onOpenDiagnosis,
  onOpenOperativeWorkflowSetup,
  onPrimaryWorkflowSelectionChange,
  onPrimaryWorkflowProcedureChange,
  onOpenPrimaryWorkflow,
  onDownloadCaseJson,
  initialFocusSection,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  activeWorkflowId: string;
  currentNodeId: string;
  operativeSetup?: OperativeWorkflowSetupState;
  onClose: () => void;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  onOpenDiagnosis: () => void;
  onOpenOperativeWorkflowSetup?: () => void;
  onPrimaryWorkflowSelectionChange: (workflowId: string, selected: boolean) => void;
  onPrimaryWorkflowProcedureChange: (workflowId: string, procedureLabel: string) => void;
  onOpenPrimaryWorkflow: (workflowId: string) => void;
  onDownloadCaseJson: () => void;
  initialFocusSection?: CaseSetupFocusTarget | null;
}) {
  const closureLabel = caseData.closure?.type
    ? caseData.closure.type.replace("closure.", "").replace(/([A-Z])/g, " $1").toLowerCase()
    : "not recorded";
  const currentNodeTitle = activeWorkflowId === operativeDirectRestorationWorkflowId
    ? "Operative readiness"
    : protocolNodes[currentNodeId]?.title || currentNodeId || "Not recorded";
  const showEndodonticCaseAudit = normalizeWorkflowInstances(caseData, currentNodeId)
    .some((instance) => instance.workflowId === endodonticRootWorkflowId);

  return (
    <main className="fixed inset-0 z-40 overflow-auto bg-brand-light-slate p-4 text-brand-navy">
      <section className="mx-auto w-full max-w-[96rem] rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Clinical workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-brand-navy sm:text-3xl">Case Setup & Status</h1>
            <p className="mt-1 text-sm text-brand-slate">Set case identity, select one or more disciplines, and review shared clinical context.</p>
          </div>
          <button onClick={onClose} className={panelActionButton.secondary}>
            Return to workspace
          </button>
        </div>

        <ClinicalDataNotice compact />

        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brand-navy">Case audit</h2>
              <p className="mt-1 text-sm text-brand-slate">
                Visit: <strong>{getCaseStatus(caseData)}</strong> · Current step: <strong>{currentNodeTitle}</strong> · Closure: <strong>{closureLabel}</strong>
              </p>
              {caseData.nextVisitPlan ? <p className="mt-1 text-sm text-brand-slate">Next visit: <strong>{caseData.nextVisitPlan}</strong></p> : null}
            </div>
            {showEndodonticCaseAudit ? <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[24rem]">
              {(caseData.canals || []).map((canal) => {
                const status = getCanalStatus(canal);
                const facts = [
                  canal.estimatedWorkingLength ? `est WL ${canal.estimatedWorkingLength} mm` : null,
                  canal.eal0 ? `EAL0 ${canal.eal0} mm` : null,
                  canal.finalShape ? `shape ${canal.finalShape}` : null,
                  canal.priorVisitStatus ? `prior ${priorCanalStatusLabels[canal.priorVisitStatus]}` : null,
                ].filter(Boolean);
                return (
                  <div key={canal.name} className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-brand-navy">{canal.name}</strong>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-brand-slate">{facts.length ? facts.join(" · ") : "No measurements yet"}</p>
                  </div>
                );
              })}
            </div> : null}
          </div>
        </div>

        <div className="mt-4">
          <CaseSetupStatusPanel
            caseData={caseData}
            activeCanal={activeCanal}
            activeWorkflowId={activeWorkflowId}
            currentNodeId={currentNodeId}
            operativeSetup={operativeSetup}
            onUpdateCase={onUpdateCase}
            onUpdatePreOp={onUpdatePreOp}
            onUpdateActiveCanal={onUpdateActiveCanal}
            onApplySuggestedCaseStatus={onApplySuggestedCaseStatus}
            onOpenAnesthesiaWorkflow={onOpenAnesthesiaWorkflow}
            onOpenIsolationWorkflow={onOpenIsolationWorkflow}
            onOpenRadiologyWorkflow={onOpenRadiologyWorkflow}
            onOpenDiagnosis={onOpenDiagnosis}
            onOpenOperativeWorkflowSetup={onOpenOperativeWorkflowSetup}
            onPrimaryWorkflowSelectionChange={onPrimaryWorkflowSelectionChange}
            onPrimaryWorkflowProcedureChange={onPrimaryWorkflowProcedureChange}
            onOpenPrimaryWorkflow={onOpenPrimaryWorkflow}
            initialFocusSection={initialFocusSection}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-brand-light-node pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={onDownloadCaseJson} className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-blue-light/30">Download plaintext NodeDent case JSON</button>
          <button onClick={onClose} className={panelActionButton.secondary}>
            Return to workspace
          </button>
        </div>
      </section>
    </main>
  );
}
