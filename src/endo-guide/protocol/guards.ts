import type { CanalRecord, DecisionGuard, EndoCase } from "../types";
import { isBlank, isPositiveMeasurement, isValidFinalShape } from "../engine/measurements";

function scopedValue(scope: "activeCanal" | "case", field: string, caseData: EndoCase, activeCanal?: CanalRecord | null) {
  const target = scope === "activeCanal" ? activeCanal : caseData;
  return field.split(".").reduce<any>((value, key) => value?.[key], target as any);
}

function compareNumeric(actualRaw: unknown, operator: DecisionGuard & { type: "numericComparison" }) {
  const actual = Number(actualRaw);
  if (!Number.isFinite(actual)) return false;
  switch (operator.operator) {
    case ">":
      return actual > operator.value;
    case ">=":
      return actual >= operator.value;
    case "<":
      return actual < operator.value;
    case "<=":
      return actual <= operator.value;
    case "=":
      return actual === operator.value;
    default:
      return false;
  }
}

function evaluateCustomGuard(id: string, activeCanal?: CanalRecord | null) {
  const estimatedWLRaw = activeCanal?.estimatedWorkingLength;
  const terminalLengthRaw = activeCanal?.fileTerminalLength;
  const estimatedWL = Number(estimatedWLRaw);
  const terminalLength = Number(terminalLengthRaw);

  if (id === "tenCReachedEstimatedWL") {
    return !(
      isPositiveMeasurement(estimatedWLRaw) &&
      isPositiveMeasurement(terminalLengthRaw) &&
      terminalLength < estimatedWL
    );
  }

  if (id === "tenCStoppedShort") {
    return !(
      isPositiveMeasurement(estimatedWLRaw) &&
      isPositiveMeasurement(terminalLengthRaw) &&
      terminalLength >= estimatedWL
    );
  }

  if (id === "validFinalShape") {
    return isValidFinalShape(activeCanal?.finalShape);
  }

  return true;
}

export function evaluateDecisionGuards(guards: DecisionGuard[] = [], caseData: EndoCase, activeCanal?: CanalRecord | null) {
  const missing: string[] = [];

  guards.forEach((guard) => {
    if (guard.type === "required") {
      const value = scopedValue(guard.scope, guard.field, caseData, activeCanal);
      if (isBlank(value)) missing.push(guard.message);
      return;
    }

    if (guard.type === "numericComparison") {
      const value = scopedValue(guard.scope, guard.field, caseData, activeCanal);
      if (isBlank(value) || !compareNumeric(value, guard)) missing.push(guard.message);
      return;
    }

    if (guard.type === "custom" && !evaluateCustomGuard(guard.id, activeCanal)) {
      missing.push(guard.message);
    }
  });

  return missing;
}
