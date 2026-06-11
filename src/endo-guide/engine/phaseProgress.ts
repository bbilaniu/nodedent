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
  if (isCurrent) return { symbol: "●", label: "Current", className: "bg-brand-navy text-white border-brand-navy" };
  if (hasProgress) return { symbol: "✓", label: "Recorded", className: "bg-brand-mint/15 text-brand-navy border-brand-mint/50" };
  return { symbol: "·", label: "Not recorded", className: "bg-brand-light-slate text-brand-slate border-brand-light-node" };
}

export function getGlobalPhaseIndicator(caseData: EndoCase, phase: string, currentPhase: string) {
  const isCurrent = phase === currentPhase;
  const hasAnyProgress = (caseData.canals || []).some((canal) => canalPhaseHasProgress(caseData, canal.name, phase));
  if (isCurrent) return { className: "bg-brand-navy text-white", textClassName: "font-bold text-brand-navy" };
  if (hasAnyProgress) return { className: "bg-brand-mint/20 text-brand-navy", textClassName: "font-semibold text-brand-navy" };
  return { className: "bg-brand-light-slate text-brand-slate", textClassName: "text-brand-slate" };
}
