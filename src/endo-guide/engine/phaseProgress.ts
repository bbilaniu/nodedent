import type { EndoCase } from "../types";
import { eventMatchesRule, phaseProgressRules } from "../protocol/phases";

export function canalPhaseHasProgress(caseData: EndoCase, canalName: string, phase: string) {
  const rules = phaseProgressRules[phase] || [];
  return (caseData.globalEvents || []).some((event) => {
    const isCaseWide = event.canal === "All" || event.canal === "N/A" || !event.canal;
    const isCanalMatch = event.canal === canalName || isCaseWide;
    return isCanalMatch && rules.some((rule) => eventMatchesRule(event.type, rule));
  });
}

export function getCanalPhaseIndicator(caseData: EndoCase, canalName: string, phase: string, currentPhase: string, activeCanalName: string) {
  const isCurrent = phase === currentPhase && canalName === activeCanalName;
  const hasProgress = canalPhaseHasProgress(caseData, canalName, phase);
  if (isCurrent) return { symbol: "●", label: "Current", className: "bg-slate-900 text-white border-slate-900" };
  if (hasProgress) return { symbol: "✓", label: "Recorded", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  return { symbol: "·", label: "Not recorded", className: "bg-slate-50 text-slate-400 border-slate-200" };
}

export function getGlobalPhaseIndicator(caseData: EndoCase, phase: string, currentPhase: string) {
  const isCurrent = phase === currentPhase;
  const hasAnyProgress = (caseData.canals || []).some((canal) => canalPhaseHasProgress(caseData, canal.name, phase));
  if (isCurrent) return { className: "bg-slate-900 text-white", textClassName: "font-bold text-slate-950" };
  if (hasAnyProgress) return { className: "bg-emerald-100 text-emerald-800", textClassName: "font-semibold text-slate-700" };
  return { className: "bg-slate-100 text-slate-500", textClassName: "text-slate-500" };
}
