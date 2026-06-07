import type { CanalRecord, DecisionOption, EndoCase } from "../types";
import { evaluateDecisionGuards } from "../protocol/guards";
import { isBlank, isPositiveMeasurement, isValidFinalShape } from "./measurements";

export function getDryingCompatibility(option: DecisionOption | null | undefined, activeCanal?: CanalRecord | null) {
  const label = option?.label || "";
  const dryingStatus = String(activeCanal?.dryingStatus || "").trim().toLowerCase();

  if (!label.includes("Paper point")) return { applies: false, compatible: true, reason: "" };
  if (!dryingStatus) return { applies: true, compatible: false, reason: "Select drying status" };
  if (label.includes("dry or slightly damp")) {
    return {
      applies: true,
      compatible: ["dry", "slightly damp"].includes(dryingStatus),
      reason: "Requires dry or slightly damp",
    };
  }
  if (label === "Paper point wet") {
    return { applies: true, compatible: dryingStatus === "wet", reason: "Requires wet" };
  }
  if (label.includes("remains wet")) {
    return { applies: true, compatible: dryingStatus === "persistent wet", reason: "Requires persistent wet" };
  }
  return { applies: false, compatible: true, reason: "" };
}

export function getMissingRequirements(nodeId: string, option: DecisionOption | null | undefined, caseData: EndoCase, activeCanal?: CanalRecord | null) {
  const missing = [...evaluateDecisionGuards(option?.guards || [], caseData, activeCanal)];
  const addMissing = (message: string) => {
    if (!missing.includes(message)) missing.push(message);
  };

  const label = option?.label || "";
  if (nodeId === "preop") {
    if (isBlank(caseData.tooth)) addMissing("Tooth");
    if (isBlank(caseData.procedureType)) addMissing("Procedure");
    if (!isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)) addMissing("Chamber depth in mm");
    if (!isPositiveMeasurement(activeCanal?.estimatedWorkingLength)) addMissing(`Estimated WL for ${activeCanal?.name || "active canal"}`);
  }
  if (nodeId === "access-chamber" && !isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)) addMissing("Chamber depth in mm");
  if (nodeId === "identify-canals" && (!caseData.canals?.length || caseData.canals.some((canal) => isBlank(canal.name)))) addMissing("At least one canal name");
  if (nodeId === "estimate-wl" && !isPositiveMeasurement(activeCanal?.estimatedWorkingLength)) addMissing(`Estimated WL for ${activeCanal?.name || "active canal"}`);
  if (nodeId === "advance-10c") {
    const estimatedWLRaw = activeCanal?.estimatedWorkingLength;
    const terminalLengthRaw = activeCanal?.fileTerminalLength;
    const estimatedWL = Number(estimatedWLRaw);
    const terminalLength = Number(terminalLengthRaw);

    if (!isPositiveMeasurement(estimatedWLRaw)) addMissing(`Estimated WL for ${activeCanal?.name || "active canal"}`);

    const selectedReachedEstimatedWL = label.includes("reached estimated WL") || label.includes("reached estimated working length");
    const selectedStoppedShort = label.includes("stopped short");

    if (selectedStoppedShort && !isPositiveMeasurement(terminalLengthRaw)) addMissing("10C terminal length");

    if (
      selectedReachedEstimatedWL &&
      isPositiveMeasurement(estimatedWLRaw) &&
      isPositiveMeasurement(terminalLengthRaw) &&
      terminalLength < estimatedWL
    ) {
      addMissing("10C terminal length is shorter than estimated WL, so this option cannot be selected");
    }

    if (
      selectedStoppedShort &&
      isPositiveMeasurement(estimatedWLRaw) &&
      isPositiveMeasurement(terminalLengthRaw) &&
      terminalLength >= estimatedWL
    ) {
      addMissing("10C terminal length is not shorter than estimated WL, so this option cannot be selected");
    }
  }
  if (nodeId === "measure-available-space") {
    const availableTreatmentSpaceRaw = activeCanal?.availableTreatmentSpace;
    const availableTreatmentSpace = Number(availableTreatmentSpaceRaw);

    if (!isPositiveMeasurement(availableTreatmentSpaceRaw)) addMissing("Available treatment space in mm");
    if (isBlank(activeCanal?.referencePoint)) addMissing("Reference point");

    if (Number.isFinite(availableTreatmentSpace) && availableTreatmentSpace > 0) {
      const selectedGreaterThan16 = label.includes(">16") || label.includes("> 16");
      const selectedLessOrEqual16 =
        label.includes("≤16") ||
        label.includes("≤ 16") ||
        label.includes("<=16") ||
        label.includes("<= 16") ||
        label.includes("<16") ||
        label.includes("< 16");

      if (selectedGreaterThan16 && availableTreatmentSpace <= 16) addMissing("Available treatment space must be >16 mm for this option");
      if (selectedLessOrEqual16 && availableTreatmentSpace > 16) addMissing("Available treatment space must be ≤16 mm for this option");
    }
  }
  if (nodeId === "establish-eal0") {
    if (!isPositiveMeasurement(activeCanal?.eal0)) addMissing("EAL 0 in mm");
    if (!isPositiveMeasurement(activeCanal?.patencyLength)) addMissing("Patency length in mm");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
    if (isBlank(activeCanal?.referencePoint)) addMissing("Reference point");
    if (isBlank(activeCanal?.wlRadiographStatus)) addMissing("WL PA status");
  }
  if (nodeId === "patency-10c" && !isPositiveMeasurement(activeCanal?.patencyLength)) addMissing("Patency length in mm");
  if (nodeId === "guide-path" && !isPositiveMeasurement(activeCanal?.eal0)) addMissing("EAL 0 / guide path length in mm");
  if (nodeId === "gauge-final-shape" && !isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
  if (nodeId === "increase-shaping-gauge") {
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
    if (label.includes("binds") && !isValidFinalShape(activeCanal?.finalShape)) addMissing("Final shape/size, e.g. 30/.04");
  }
  if (nodeId === "create-final-shape" && label.includes("reached") && !isValidFinalShape(activeCanal?.finalShape)) addMissing("Final shape/size, e.g. 30/.04");
  if (nodeId === "remove-smear-layer") {
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
    if (!isValidFinalShape(activeCanal?.finalShape)) addMissing("Final shape/size, e.g. 30/.04");
  }
  if (nodeId === "agitate-edta" && !isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
  if (["gauge-obturation-30", "gauge-obturation-25"].includes(nodeId) && !isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
  if (["gauge-obturation-larger", "record-obturation-gauge"].includes(nodeId) && isBlank(activeCanal?.obturationGauge)) addMissing("Obturation gauge size, e.g. 30");
  if (nodeId === "fit-master-cone") {
    if (isBlank(activeCanal?.masterCone)) addMissing("Master cone, e.g. 30/.04");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
  }
  if (nodeId === "cone-long") {
    if (isBlank(activeCanal?.masterCone)) addMissing("Master cone");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
    if (isBlank(activeCanal?.referencePoint)) addMissing("Reference point");
  }
  if (nodeId === "cone-fit-radiograph" && isBlank(activeCanal?.coneFitRadiograph)) addMissing("Cone fit radiograph status");
  if (nodeId === "dry-for-obturation") {
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
    const dryingCompatibility = getDryingCompatibility(option, activeCanal);
    if (dryingCompatibility.applies && !dryingCompatibility.compatible) addMissing(dryingCompatibility.reason);
  }
  if (nodeId === "patency-before-sealer" && !isPositiveMeasurement(activeCanal?.patencyLength)) addMissing("Patency length in mm");
  if (nodeId === "paper-point-through-sealer" && !isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
  if (nodeId === "seat-gp-cone") {
    if (isBlank(activeCanal?.masterCone)) addMissing("Master cone");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) addMissing("Shaping length in mm");
  }
  return missing;
}

export function validateDecision(nodeId: string, option: DecisionOption | null | undefined, caseData: EndoCase, activeCanal?: CanalRecord | null) {
  return getMissingRequirements(nodeId, option, caseData, activeCanal);
}
