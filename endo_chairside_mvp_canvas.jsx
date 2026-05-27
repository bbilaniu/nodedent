import React, { useMemo, useState } from "react";

const difficultyStyles = {
  none: "bg-emerald-50 text-emerald-800 border-emerald-200",
  caution: "bg-amber-50 text-amber-900 border-amber-200",
  high: "bg-orange-50 text-orange-900 border-orange-200",
  refer: "bg-red-50 text-red-900 border-red-200",
};

const difficultyLabels = {
  none: "Green · routine pathway",
  caution: "Yellow · proceed with caution",
  high: "Orange · high difficulty",
  refer: "Red · consider temporization/referral",
};

const phases = [
  "Pre-op",
  "Access",
  "Initial scouting",
  "Working length",
  "Glide path",
  "Shaping",
  "Troubleshooting",
  "Medication / closure",
  "Export",
];

const protocolNodes = {
  preop: {
    id: "preop",
    phase: "Pre-op",
    title: "Pre-op setup",
    chairsideInstruction:
      "Review radiographs/CBCT if available. Estimate target chamber depth and estimated working length before access.",
    instruments: ["Pre-op PA/BW", "CBCT if available", "Rubber dam armamentarium"],
    requiredInputs: ["Tooth", "Procedure type", "Estimated chamber depth", "Estimated WL per canal"],
    safetyNotes: ["This guide supports workflow/documentation only and does not replace clinical judgment."],
    options: [
      {
        label: "Pre-op review complete",
        nextNodeId: "access-chamber",
        noteEvent: { type: "preop.reviewCompleted" },
      },
    ],
  },
  "access-chamber": {
    id: "access-chamber",
    phase: "Access",
    title: "Access pulp chamber",
    chairsideInstruction:
      "Mark the 557 bur to the estimated target vertical depth. Access toward the pulp chamber and rinse as needed.",
    instruments: ["557 bur", "Water rinse"],
    requiredInputs: ["Estimated chamber depth"],
    safetyNotes: ["If marked depth is reached without chamber entry, stop and reassess radiographically."],
    options: [
      {
        label: "Chamber reached",
        nextNodeId: "confirm-chamber",
        noteEvent: { type: "access.chamberReached" },
      },
      {
        label: "Marked depth reached but chamber not found",
        nextNodeId: "access-reassess",
        difficultyFlag: "caution",
        noteEvent: { type: "access.markedDepthNoChamber" },
      },
    ],
  },
  "access-reassess": {
    id: "access-reassess",
    phase: "Access",
    title: "Stop and reassess access direction",
    chairsideInstruction:
      "Capture BW/PA as appropriate. Evaluate access orientation relative to the long axis and redirect accordingly.",
    instruments: ["BW/PA radiograph", "DG16/17", "557 bur"],
    safetyNotes: ["Do not continue blindly beyond the marked depth."],
    options: [
      {
        label: "Radiograph taken and access redirected",
        nextNodeId: "access-chamber",
        noteEvent: { type: "access.radiographRedirected" },
      },
      {
        label: "Difficulty exceeds comfort · refer/temporize",
        nextNodeId: "refer-pathway",
        difficultyFlag: "refer",
        noteEvent: { type: "difficulty.exceedsComfort" },
      },
    ],
  },
  "confirm-chamber": {
    id: "confirm-chamber",
    phase: "Access",
    title: "Confirm chamber access",
    chairsideInstruction: "Confirm entry into the pulp chamber with a DG16/17 endodontic explorer.",
    instruments: ["DG16/17 Endo Explorer"],
    options: [
      {
        label: "Pulp chamber confirmed",
        nextNodeId: "refine-access",
        noteEvent: { type: "access.chamberConfirmed" },
      },
      {
        label: "Chamber not confirmed",
        nextNodeId: "access-reassess",
        difficultyFlag: "caution",
        noteEvent: { type: "access.chamberNotConfirmed" },
      },
    ],
  },
  "refine-access": {
    id: "refine-access",
    phase: "Access",
    title: "Refine access outline",
    chairsideInstruction: "Cut and refine the access outline form with an Endo-Z bur. Rinse as needed.",
    instruments: ["Endo-Z bur", "Water rinse"],
    options: [
      {
        label: "Access refined",
        nextNodeId: "identify-canals",
        noteEvent: { type: "access.refined" },
      },
    ],
  },
  "identify-canals": {
    id: "identify-canals",
    phase: "Access",
    title: "Identify canals",
    chairsideInstruction:
      "Identify canals with a DG16/17 explorer. Add or rename canals in the canal panel before continuing.",
    instruments: ["DG16/17 Endo Explorer"],
    requiredInputs: ["Canal names"],
    options: [
      {
        label: "Canals identified",
        nextNodeId: "estimate-wl",
        noteEvent: { type: "access.canalsIdentified" },
      },
    ],
  },
  "estimate-wl": {
    id: "estimate-wl",
    phase: "Initial scouting",
    title: "Estimate working length",
    chairsideInstruction:
      "Estimate working length from the pre-op PA. Set the 10C file stopper to estimated WL for the active canal.",
    instruments: ["Pre-op PA", "10C hand file"],
    requiredInputs: ["Estimated WL for active canal"],
    options: [
      {
        label: "10C stopper set to estimated WL",
        nextNodeId: "advance-10c",
        noteEvent: { type: "scouting.estimatedWLSet" },
      },
    ],
  },
  "advance-10c": {
    id: "advance-10c",
    phase: "Initial scouting",
    title: "Advance 10C to passive resistance",
    chairsideInstruction:
      "Place lubricant or aqueous irrigation. Advance 10C hand file to passive resistance. Do not exceed estimated WL.",
    instruments: ["10C hand file"],
    materials: ["File lubricant or aqueous irrigation"],
    requiredInputs: ["File terminal length if short"],
    safetyNotes: ["Do not exceed estimated WL."],
    options: [
      {
        label: "10C reached estimated WL",
        nextNodeId: "open-orifice",
        noteEvent: { type: "scouting.estimatedWLReached" },
      },
      {
        label: "10C stopped short",
        nextNodeId: "measure-available-space",
        noteEvent: { type: "scouting.fileStoppedShort" },
      },
    ],
  },
  "measure-available-space": {
    id: "measure-available-space",
    phase: "Initial scouting",
    title: "Measure available treatment space",
    chairsideInstruction:
      "With the 10C at its terminal position, adjust the stopper to a reproducible reference point, remove the file, and measure the available treatment space.",
    instruments: ["10C hand file", "Endo ruler"],
    requiredInputs: ["Available treatment space", "Reference point"],
    options: [
      {
        label: "Available treatment space >16 mm",
        nextNodeId: "open-orifice",
        difficultyFlag: "caution",
        noteEvent: { type: "scouting.availableSpaceGreaterThan16" },
      },
      {
        label: "Available treatment space ≤16 mm",
        nextNodeId: "limited-space-warning",
        difficultyFlag: "high",
        noteEvent: { type: "scouting.availableSpaceLimited" },
      },
    ],
  },
  "limited-space-warning": {
    id: "limited-space-warning",
    phase: "Troubleshooting",
    title: "Limited treatment space warning",
    chairsideInstruction:
      "Available treatment space is ≤16 mm. Case difficulty increases significantly. Continue only if appropriate and within comfort/skill limits.",
    safetyNotes: ["Consider staged care, CBCT review, magnification, or referral."],
    options: [
      {
        label: "Proceed with extreme caution",
        nextNodeId: "open-orifice",
        difficultyFlag: "high",
        noteEvent: { type: "difficulty.proceededWithExtremeCaution" },
      },
      {
        label: "Medicate and temporize",
        nextNodeId: "calcium-hydroxide",
        difficultyFlag: "refer",
        noteEvent: { type: "treatment.medicateTemporizeSelected" },
      },
      {
        label: "Refer",
        nextNodeId: "refer-pathway",
        difficultyFlag: "refer",
        noteEvent: { type: "treatment.referralSelected" },
      },
    ],
  },
  "open-orifice": {
    id: "open-orifice",
    phase: "Working length",
    title: "Open canal orifice",
    chairsideInstruction:
      "Open the canal orifice with a dedicated engine-driven orifice opener. Advance into the canal but do not exceed 15 mm. Irrigate with diluted NaOCl.",
    instruments: ["Orifice opener file"],
    materials: ["Diluted NaOCl"],
    safetyNotes: ["Do not exceed 15 mm with the orifice opener."],
    options: [
      {
        label: "Orifice opened and irrigated",
        nextNodeId: "dry-canal",
        noteEvent: { type: "orifice.opened" },
      },
    ],
  },
  "dry-canal": {
    id: "dry-canal",
    phase: "Working length",
    title: "Dry canal for EAL",
    chairsideInstruction: "Dry canal with measured paper points before attempting electronic working length.",
    instruments: ["25/.04 paper points"],
    options: [
      {
        label: "Canal dried",
        nextNodeId: "attach-eal",
        noteEvent: { type: "canal.driedForEAL" },
      },
      {
        label: "Canal remains wet",
        nextNodeId: "persistent-wet",
        difficultyFlag: "high",
        noteEvent: { type: "drying.persistentWetBeforeEAL" },
      },
    ],
  },
  "attach-eal": {
    id: "attach-eal",
    phase: "Working length",
    title: "Attach EAL to 10C file",
    chairsideInstruction:
      "Attach the EAL to the 10C hand file and attempt to establish electronic working length.",
    instruments: ["EAL", "10C hand file"],
    options: [
      {
        label: "EAL signals patency",
        nextNodeId: "establish-eal0",
        noteEvent: { type: "workingLength.ealPatencySignal" },
      },
      {
        label: "EAL reads short at terminal length",
        nextNodeId: "file-stop-vs-resistance",
        difficultyFlag: "caution",
        noteEvent: { type: "workingLength.ealReadsShort" },
      },
    ],
  },
  "file-stop-vs-resistance": {
    id: "file-stop-vs-resistance",
    phase: "Troubleshooting",
    title: "File resistance vs file stop",
    chairsideInstruction:
      "Determine whether the 10C file is encountering file resistance or a file stop.",
    options: [
      {
        label: "File resistance",
        nextNodeId: "middle-third-guide-path",
        difficultyFlag: "caution",
        noteEvent: { type: "troubleshooting.fileResistance" },
      },
      {
        label: "File stop",
        nextNodeId: "prebend-10c",
        difficultyFlag: "high",
        noteEvent: { type: "troubleshooting.fileStop" },
      },
      {
        label: "Difficulty exceeds comfort",
        nextNodeId: "refer-pathway",
        difficultyFlag: "refer",
        noteEvent: { type: "difficulty.exceedsComfort" },
      },
    ],
  },
  "prebend-10c": {
    id: "prebend-10c",
    phase: "Troubleshooting",
    title: "Pre-bend 10C file",
    chairsideInstruction:
      "Place lubricant or aqueous irrigation. Use file bending technique with the 10C file and reassess advancement.",
    instruments: ["10C hand file"],
    materials: ["File lubricant or aqueous irrigation"],
    options: [
      {
        label: "File advances",
        nextNodeId: "dry-canal",
        noteEvent: { type: "troubleshooting.prebendFileAdvanced" },
      },
      {
        label: "File does not advance",
        nextNodeId: "limited-space-warning",
        difficultyFlag: "high",
        noteEvent: { type: "troubleshooting.prebendFailed" },
      },
    ],
  },
  "middle-third-guide-path": {
    id: "middle-third-guide-path",
    phase: "Troubleshooting",
    title: "Open middle third",
    chairsideInstruction:
      "Place lubricant or aqueous irrigation. Open the middle third with a dedicated guide path file to resistance. Do not exceed available treatment space.",
    instruments: ["Guide path file"],
    materials: ["File lubricant or aqueous irrigation", "Diluted NaOCl"],
    safetyNotes: ["Do not exceed available treatment space."],
    options: [
      {
        label: "Middle third opened and irrigated",
        nextNodeId: "dry-canal",
        noteEvent: { type: "troubleshooting.middleThirdOpened" },
      },
      {
        label: "Cannot safely advance",
        nextNodeId: "refer-pathway",
        difficultyFlag: "refer",
        noteEvent: { type: "troubleshooting.middleThirdNotSafe" },
      },
    ],
  },
  "establish-eal0": {
    id: "establish-eal0",
    phase: "Working length",
    title: "Establish EAL 0",
    chairsideInstruction:
      "Adjust the 10C hand file until the EAL reads 0. Capture a working length radiograph and record EAL 0, patency length, shaping length, canal location, and reference point.",
    instruments: ["EAL", "10C hand file", "WL radiograph"],
    requiredInputs: ["EAL 0", "Patency length", "Shaping length", "Reference point"],
    options: [
      {
        label: "EAL 0 recorded and WL radiograph taken",
        nextNodeId: "patency-10c",
        noteEvent: { type: "workingLength.established" },
      },
    ],
  },
  "patency-10c": {
    id: "patency-10c",
    phase: "Glide path",
    title: "10C to patency length until super loose",
    chairsideInstruction:
      "Measure the 10C hand file to patency length. Work at patency length in filing/reciprocating motion until the 10C becomes super loose. Irrigate.",
    instruments: ["10C hand file"],
    materials: ["Diluted NaOCl", "File lubricant or aqueous irrigation"],
    requiredInputs: ["Patency length"],
    options: [
      {
        label: "10C achieved patency length and is super loose",
        nextNodeId: "guide-path",
        noteEvent: { type: "glidePath.patencyAchieved" },
      },
      {
        label: "10C stops short of patency length",
        nextNodeId: "prebend-10c",
        difficultyFlag: "high",
        noteEvent: { type: "glidePath.patencyShort" },
      },
    ],
  },
  "guide-path": {
    id: "guide-path",
    phase: "Glide path",
    title: "Create guide path",
    chairsideInstruction:
      "Measure a dedicated engine-driven guide path file to EAL 0 / guide path length and advance. Irrigate after use.",
    instruments: ["Guide path file"],
    materials: ["Diluted NaOCl"],
    requiredInputs: ["EAL 0 / guide path length"],
    options: [
      {
        label: "Guide path file reached EAL 0",
        nextNodeId: "gauge-final-shape",
        noteEvent: { type: "glidePath.created" },
      },
      {
        label: "Guide path file did not reach EAL 0",
        nextNodeId: "patency-10c",
        difficultyFlag: "caution",
        noteEvent: { type: "glidePath.fileShort" },
      },
    ],
  },
  "gauge-final-shape": {
    id: "gauge-final-shape",
    phase: "Shaping",
    title: "Gauge for final shape",
    chairsideInstruction:
      "Set the stopper to shaping length on a 25 NiTi hand file. Advance to shaping length and assess resistance.",
    instruments: ["25 NiTi hand file"],
    requiredInputs: ["Shaping length"],
    options: [
      {
        label: "25 NiTi reaches shaping length with no resistance",
        nextNodeId: "create-final-shape",
        noteEvent: { type: "shaping.gaugeNoResistance" },
      },
      {
        label: "NiTi reaches within 0–2 mm with resistance",
        nextNodeId: "create-final-shape",
        difficultyFlag: "caution",
        noteEvent: { type: "shaping.gaugeResistanceNearLength" },
      },
      {
        label: "NiTi >2 mm short",
        nextNodeId: "patency-10c",
        difficultyFlag: "high",
        noteEvent: { type: "shaping.gaugeMoreThan2mmShort" },
      },
    ],
  },
  "create-final-shape": {
    id: "create-final-shape",
    phase: "Shaping",
    title: "Create final .04 shape",
    chairsideInstruction:
      "Choose a .04 tapered engine-driven file matching the gauged tip size. Set stopper to shaping length and advance to shaping length.",
    instruments: [".04 tapered engine-driven file"],
    requiredInputs: ["Final shape"],
    options: [
      {
        label: ".04 file reached shaping length",
        nextNodeId: "irrigate-recapitulate",
        noteEvent: { type: "shaping.finalShapeAchieved" },
      },
      {
        label: ".04 file did not reach shaping length",
        nextNodeId: "patency-10c",
        difficultyFlag: "caution",
        noteEvent: { type: "shaping.finalShapeShort" },
      },
    ],
  },
  "irrigate-recapitulate": {
    id: "irrigate-recapitulate",
    phase: "Shaping",
    title: "Irrigate and recapitulate",
    chairsideInstruction:
      "Irrigate with NaOCl. Recapitulate with 10C to patency length until super loose. This MVP stops after shaping/medication pathways.",
    instruments: ["10C hand file", "Irrigation syringe"],
    materials: ["NaOCl"],
    options: [
      {
        label: "Canal shaped and recapitulated",
        nextNodeId: "mvp-complete",
        noteEvent: { type: "shaping.completed" },
      },
      {
        label: "Canal remains wet / cannot complete today",
        nextNodeId: "persistent-wet",
        difficultyFlag: "high",
        noteEvent: { type: "drying.persistentWetAfterShaping" },
      },
      {
        label: "Medicate and temporize",
        nextNodeId: "calcium-hydroxide",
        noteEvent: { type: "treatment.medicateTemporizeSelected" },
      },
    ],
  },
  "persistent-wet": {
    id: "persistent-wet",
    phase: "Troubleshooting",
    title: "Persistent wet canal",
    chairsideInstruction:
      "Repeat drying with measured paper points. If canal remains wet after several attempts, place calcium hydroxide and temporize.",
    instruments: ["25/.04 paper points", "White NaviTip"],
    materials: ["Calcium hydroxide", "Temporary restorative material"],
    options: [
      {
        label: "Canal dried",
        nextNodeId: "attach-eal",
        noteEvent: { type: "drying.canalDriedAfterRepeat" },
      },
      {
        label: "Persistent wet canal · place calcium hydroxide",
        nextNodeId: "calcium-hydroxide",
        difficultyFlag: "high",
        noteEvent: { type: "drying.persistentWetConfirmed" },
      },
    ],
  },
  "calcium-hydroxide": {
    id: "calcium-hydroxide",
    phase: "Medication / closure",
    title: "Place calcium hydroxide",
    chairsideInstruction:
      "Place calcium hydroxide with a White NaviTip into the canal. Proceed to temporary closure.",
    instruments: ["White NaviTip"],
    materials: ["Calcium hydroxide"],
    options: [
      {
        label: "Calcium hydroxide placed",
        nextNodeId: "temporary-closure",
        noteEvent: { type: "medication.calciumHydroxidePlaced" },
      },
    ],
  },
  "temporary-closure": {
    id: "temporary-closure",
    phase: "Medication / closure",
    title: "Temporary closure",
    chairsideInstruction:
      "Close access with sponge and temporary restorative material. Document the pathway and planned next step.",
    materials: ["Sponge", "Temporary restorative material"],
    options: [
      {
        label: "Access temporized",
        nextNodeId: "mvp-complete",
        noteEvent: { type: "closure.temporary" },
      },
    ],
  },
  "refer-pathway": {
    id: "refer-pathway",
    phase: "Medication / closure",
    title: "Referral / stop pathway",
    chairsideInstruction:
      "Document difficulty and consider medication/temporization or referral according to clinical judgment.",
    safetyNotes: ["Referral is appropriate when treatment exceeds comfort, skill, equipment, or case difficulty limits."],
    options: [
      {
        label: "Document referral recommended",
        nextNodeId: "mvp-complete",
        difficultyFlag: "refer",
        noteEvent: { type: "treatment.referralRecommended" },
      },
      {
        label: "Medicate and temporize instead",
        nextNodeId: "calcium-hydroxide",
        difficultyFlag: "refer",
        noteEvent: { type: "treatment.medicateTemporizeSelected" },
      },
    ],
  },
  "mvp-complete": {
    id: "mvp-complete",
    phase: "Export",
    title: "MVP pathway complete",
    chairsideInstruction:
      "This MVP pathway has enough structured data to generate a compact clinical note and JSON export. Continue another canal, undo, or copy the note.",
    options: [
      {
        label: "Start another canal at estimated WL",
        nextNodeId: "estimate-wl",
        noteEvent: { type: "workflow.nextCanalSelected" },
      },
      {
        label: "Return to pre-op",
        nextNodeId: "preop",
        noteEvent: { type: "workflow.returnedToStart" },
      },
    ],
  },
};

function makeEvent({ type, tooth, canal, nodeId, label, details = {} }) {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    type,
    tooth,
    canal,
    details: { nodeId, decisionLabel: label, ...details },
  };
}

function compactList(values) {
  return values.filter(Boolean).join(", ");
}

function buildCompactNote(caseData) {
  const canals = caseData.canals || [];
  const located = canals.map((c) => c.name).filter(Boolean);
  const canalMeasurements = canals
    .map((c) => {
      const bits = [];
      if (c.eal0) bits.push(`EAL0 ${c.eal0} mm`);
      if (c.patencyLength) bits.push(`patency ${c.patencyLength} mm`);
      if (c.shapingLength) bits.push(`shape length ${c.shapingLength} mm`);
      if (c.finalShape) bits.push(`final ${c.finalShape}`);
      if (c.masterCone) bits.push(`MC ${c.masterCone}`);
      return bits.length ? `${c.name}: ${bits.join("; ")}` : null;
    })
    .filter(Boolean);

  const eventTypes = caseData.globalEvents.map((e) => e.type);
  const hadAccess = eventTypes.some((t) => t.startsWith("access."));
  const hadWL = eventTypes.includes("workingLength.established");
  const shaped = eventTypes.includes("shaping.completed") || canals.some((c) => c.finalShape);
  const medicated = eventTypes.includes("medication.calciumHydroxidePlaced");
  const temp = eventTypes.includes("closure.temporary");
  const referral = eventTypes.includes("treatment.referralRecommended");

  const note = [];
  note.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}.`);
  note.push("RD isolation planned/used as clinically appropriate.");
  if (hadAccess) note.push("Access completed/refined and chamber/canal negotiation documented.");
  if (located.length) note.push(`Canals: ${located.join("/")}.`);
  if (hadWL || canalMeasurements.length) note.push(`WL/shape data: ${canalMeasurements.join(" | ")}.`);
  if (shaped) note.push("NaOCl irrigation used during instrumentation; canal shaping/recapitulation documented.");
  if (medicated) note.push("Calcium hydroxide placed.");
  if (temp) note.push("Access closed with sponge and temporary restorative material.");
  if (referral) note.push("Increased case difficulty noted; referral recommended/discussed.");
  if (caseData.difficulty && caseData.difficulty !== "none") note.push(`Difficulty flag: ${caseData.difficulty}.`);
  note.push("POIG.");
  return note.join(" ");
}

function buildFullNote(caseData) {
  const lines = [];
  lines.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}`);
  lines.push("");
  lines.push("Clinical workflow note generated from chairside decision guide events.");
  lines.push("");
  lines.push("Canal records:");
  caseData.canals.forEach((c) => {
    lines.push(`- ${c.name}`);
    if (c.estimatedWorkingLength) lines.push(`  - Estimated WL: ${c.estimatedWorkingLength} mm`);
    if (c.availableTreatmentSpace) lines.push(`  - Available treatment space: ${c.availableTreatmentSpace} mm`);
    if (c.referencePoint) lines.push(`  - Reference point: ${c.referencePoint}`);
    if (c.eal0) lines.push(`  - EAL 0: ${c.eal0} mm`);
    if (c.patencyLength) lines.push(`  - Patency length: ${c.patencyLength} mm`);
    if (c.shapingLength) lines.push(`  - Shaping length: ${c.shapingLength} mm`);
    if (c.finalShape) lines.push(`  - Final shape: ${c.finalShape}`);
    if (c.masterCone) lines.push(`  - Master cone: ${c.masterCone}`);
    if (c.dryingStatus) lines.push(`  - Drying status: ${c.dryingStatus}`);
  });
  lines.push("");
  lines.push("Events:");
  caseData.globalEvents.forEach((e) => {
    lines.push(`- ${new Date(e.timestamp).toLocaleTimeString()} · ${e.canal || "global"} · ${e.type}`);
  });
  lines.push("");
  lines.push(buildCompactNote(caseData));
  return lines.join("\n");
}

function buildPatientSummary(caseData) {
  const tooth = caseData.tooth || "the tooth";
  const medicated = caseData.globalEvents.some((e) => e.type === "medication.calciumHydroxidePlaced");
  const shaped = caseData.globalEvents.some((e) => e.type === "shaping.completed");
  if (medicated) {
    return `Root canal treatment was started on tooth ${tooth}. The canals were cleaned as appropriate today, medication was placed inside the tooth, and a temporary filling was placed. Further treatment or referral may be needed depending on healing and case difficulty.`;
  }
  if (shaped) {
    return `Root canal treatment steps were performed on tooth ${tooth}. The canals were located, measured, cleaned, shaped, and disinfected according to the recorded workflow. A final restoration may still be required to protect the tooth.`;
  }
  return `Endodontic treatment workflow was started for tooth ${tooth}. The clinician recorded diagnostic and procedural information to guide care and documentation.`;
}

function buildJsonExport(caseData) {
  return {
    tooth: caseData.tooth,
    procedureType: caseData.procedureType,
    difficulty: caseData.difficulty,
    preOp: caseData.preOp,
    canals: caseData.canals.map(({ events, ...rest }) => rest),
    closure: caseData.closure,
    events: caseData.globalEvents,
  };
}

const initialCase = {
  tooth: "36",
  procedureType: "RCT",
  difficulty: "none",
  preOp: {
    radiographsReviewed: true,
    cbctReviewed: false,
    estimatedChamberDepth: "",
  },
  currentCanal: "MB",
  canals: [
    {
      name: "MB",
      estimatedWorkingLength: "",
      availableTreatmentSpace: "",
      referencePoint: "",
      eal0: "",
      patencyLength: "",
      shapingLength: "",
      finalShape: "",
      masterCone: "",
      dryingStatus: "",
      events: [],
    },
  ],
  globalEvents: [],
  closure: null,
};

function TextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionCard({ title, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

export default function EndoChairsideGuideMVP() {
  const [caseData, setCaseData] = useState(initialCase);
  const [currentNodeId, setCurrentNodeId] = useState("preop");
  const [history, setHistory] = useState([]);
  const [newCanalName, setNewCanalName] = useState("ML");
  const [noteMode, setNoteMode] = useState("compact");
  const [copied, setCopied] = useState(false);

  const currentNode = protocolNodes[currentNodeId] || protocolNodes.preop;
  const activeCanal = useMemo(
    () => caseData.canals.find((c) => c.name === caseData.currentCanal) || caseData.canals[0],
    [caseData.canals, caseData.currentCanal]
  );

  const activePhaseIndex = phases.indexOf(currentNode.phase);

  function updateCase(updates) {
    setCaseData((prev) => ({ ...prev, ...updates }));
  }

  function updatePreOp(field, value) {
    setCaseData((prev) => ({ ...prev, preOp: { ...prev.preOp, [field]: value } }));
  }

  function updateActiveCanal(field, value) {
    setCaseData((prev) => ({
      ...prev,
      canals: prev.canals.map((c) => (c.name === prev.currentCanal ? { ...c, [field]: value } : c)),
    }));
  }

  function addCanal() {
    const trimmed = newCanalName.trim().toUpperCase();
    if (!trimmed) return;
    if (caseData.canals.some((c) => c.name === trimmed)) {
      updateCase({ currentCanal: trimmed });
      return;
    }
    setCaseData((prev) => ({
      ...prev,
      currentCanal: trimmed,
      canals: [
        ...prev.canals,
        {
          name: trimmed,
          estimatedWorkingLength: "",
          availableTreatmentSpace: "",
          referencePoint: "",
          eal0: "",
          patencyLength: "",
          shapingLength: "",
          finalShape: "",
          masterCone: "",
          dryingStatus: "",
          events: [],
        },
      ],
    }));
  }

  function applyDecision(option) {
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);

    const event = option.noteEvent
      ? makeEvent({
          type: option.noteEvent.type,
          tooth: caseData.tooth,
          canal: activeCanal?.name,
          nodeId: currentNode.id,
          label: option.label,
          details: option.noteEvent.details,
        })
      : null;

    setCaseData((prev) => {
      const nextDifficulty = option.difficultyFlag || prev.difficulty || "none";
      const nextClosure =
        option.noteEvent?.type === "closure.temporary"
          ? { type: "temporary", material: "sponge and temporary restorative material" }
          : prev.closure;

      return {
        ...prev,
        difficulty: nextDifficulty,
        closure: nextClosure,
        canals: event
          ? prev.canals.map((c) =>
              c.name === prev.currentCanal ? { ...c, events: [...(c.events || []), event] } : c
            )
          : prev.canals,
        globalEvents: event ? [...prev.globalEvents, event] : prev.globalEvents,
      };
    });

    setCurrentNodeId(option.nextNodeId);
    setCopied(false);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setCaseData(previous.caseData);
    setCurrentNodeId(previous.currentNodeId);
    setHistory((prev) => prev.slice(0, -1));
  }

  const compactNote = buildCompactNote(caseData);
  const fullNote = buildFullNote(caseData);
  const patientSummary = buildPatientSummary(caseData);
  const jsonExport = JSON.stringify(buildJsonExport(caseData), null, 2);
  const displayedNote =
    noteMode === "compact" ? compactNote : noteMode === "full" ? fullNote : noteMode === "patient" ? patientSummary : jsonExport;

  async function copyDisplayedNote() {
    try {
      await navigator.clipboard.writeText(displayedNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Canvas MVP</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Endodontic Chairside Decision Guide
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                A state-machine prototype that shows one clinical decision at a time while generating an event-based note.
                This is a workflow/documentation aid and does not replace diagnosis, informed consent, clinical judgment, or referral.
              </p>
            </div>
            <div className="grid min-w-[320px] grid-cols-2 gap-3">
              <TextInput label="Tooth" value={caseData.tooth} onChange={(v) => updateCase({ tooth: v })} />
              <SelectInput
                label="Procedure"
                value={caseData.procedureType}
                onChange={(v) => updateCase({ procedureType: v })}
                options={["RCT", "RCT initiated", "Retreatment", "Emergency pulpectomy"]}
              />
              <TextInput
                label="Chamber depth"
                value={caseData.preOp.estimatedChamberDepth}
                onChange={(v) => updatePreOp("estimatedChamberDepth", v)}
                placeholder="mm"
              />
              <SelectInput
                label="Difficulty"
                value={caseData.difficulty}
                onChange={(v) => updateCase({ difficulty: v })}
                options={["none", "caution", "high", "refer"]}
              />
            </div>
          </div>
        </header>

        <div className={`rounded-2xl border p-4 text-sm shadow-sm ${difficultyStyles[caseData.difficulty]}`}>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <strong>{difficultyLabels[caseData.difficulty]}</strong>
            <span>
              Current phase: <strong>{currentNode.phase}</strong> · Active canal: <strong>{activeCanal?.name}</strong>
            </span>
          </div>
        </div>

        <main className="grid gap-4 lg:grid-cols-[320px_1fr_420px]">
          <aside className="space-y-4">
            <SectionCard title="Canals">
              <div className="mb-3 flex flex-wrap gap-2">
                {caseData.canals.map((canal) => (
                  <button
                    key={canal.name}
                    onClick={() => updateCase({ currentCanal: canal.name })}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      canal.name === caseData.currentCanal
                        ? "bg-slate-900 text-white shadow-sm"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {canal.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCanalName}
                  onChange={(e) => setNewCanalName(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="MB2"
                />
                <button onClick={addCanal} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                  Add
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Measurements">
              <div className="grid gap-3">
                <TextInput
                  label="Estimated WL"
                  value={activeCanal?.estimatedWorkingLength}
                  onChange={(v) => updateActiveCanal("estimatedWorkingLength", v)}
                  placeholder="mm"
                />
                <TextInput
                  label="Available treatment space"
                  value={activeCanal?.availableTreatmentSpace}
                  onChange={(v) => updateActiveCanal("availableTreatmentSpace", v)}
                  placeholder="mm"
                />
                <TextInput
                  label="Reference point"
                  value={activeCanal?.referencePoint}
                  onChange={(v) => updateActiveCanal("referencePoint", v)}
                  placeholder="e.g., MB cusp"
                />
                <div className="grid grid-cols-3 gap-2">
                  <TextInput label="EAL 0" value={activeCanal?.eal0} onChange={(v) => updateActiveCanal("eal0", v)} placeholder="mm" />
                  <TextInput
                    label="Patency"
                    value={activeCanal?.patencyLength}
                    onChange={(v) => updateActiveCanal("patencyLength", v)}
                    placeholder="mm"
                  />
                  <TextInput
                    label="Shaping"
                    value={activeCanal?.shapingLength}
                    onChange={(v) => updateActiveCanal("shapingLength", v)}
                    placeholder="mm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextInput
                    label="Final shape"
                    value={activeCanal?.finalShape}
                    onChange={(v) => updateActiveCanal("finalShape", v)}
                    placeholder="30/.04"
                  />
                  <TextInput
                    label="Master cone"
                    value={activeCanal?.masterCone}
                    onChange={(v) => updateActiveCanal("masterCone", v)}
                    placeholder="30/.04"
                  />
                </div>
                <SelectInput
                  label="Drying status"
                  value={activeCanal?.dryingStatus || ""}
                  onChange={(v) => updateActiveCanal("dryingStatus", v)}
                  options={["", "dry", "slightly damp", "wet", "persistent wet"]}
                />
              </div>
            </SectionCard>

            <SectionCard title="Phase map">
              <ol className="space-y-2">
                {phases.map((phase, idx) => (
                  <li key={phase} className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === activePhaseIndex
                          ? "bg-slate-900 text-white"
                          : idx < activePhaseIndex
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className={idx === activePhaseIndex ? "font-semibold text-slate-950" : "text-slate-600"}>{phase}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </aside>

          <section className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{currentNode.phase}</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">{currentNode.title}</h2>
                </div>
                <button
                  onClick={undo}
                  disabled={!history.length}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Undo last decision
                </button>
              </div>

              <p className="rounded-2xl bg-slate-50 p-4 text-base leading-7 text-slate-800">{currentNode.chairsideInstruction}</p>

              {(currentNode.instruments?.length || currentNode.materials?.length || currentNode.requiredInputs?.length) && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {currentNode.instruments?.length ? (
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Instruments</h4>
                      <p className="mt-2 text-sm text-slate-700">{compactList(currentNode.instruments)}</p>
                    </div>
                  ) : null}
                  {currentNode.materials?.length ? (
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Materials</h4>
                      <p className="mt-2 text-sm text-slate-700">{compactList(currentNode.materials)}</p>
                    </div>
                  ) : null}
                  {currentNode.requiredInputs?.length ? (
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Record</h4>
                      <p className="mt-2 text-sm text-slate-700">{compactList(currentNode.requiredInputs)}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {currentNode.safetyNotes?.length ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong>Safety / stop rule</strong>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {currentNode.safetyNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                {currentNode.options.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => applyDecision(option)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                  >
                    {option.label}
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Next: {protocolNodes[option.nextNodeId]?.title || option.nextNodeId}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <SectionCard title="Recent event log">
              {caseData.globalEvents.length ? (
                <div className="max-h-56 space-y-2 overflow-auto pr-1">
                  {[...caseData.globalEvents].reverse().slice(0, 8).map((event) => (
                    <div key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-slate-800">{event.type}</strong>
                        <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {event.canal || "global"} · {event.details?.decisionLabel}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No events yet. Select a decision to start the note trail.</p>
              )}
            </SectionCard>
          </section>

          <aside className="space-y-4">
            <SectionCard title="Live note preview">
              <div className="mb-3 grid grid-cols-2 gap-2">
                {["compact", "full", "patient", "json"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setNoteMode(mode)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${
                      noteMode === mode ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <textarea
                readOnly
                value={displayedNote}
                className="h-[420px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-800 outline-none"
              />
              <button
                onClick={copyDisplayedNote}
                className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {copied ? "Copied" : "Copy current output"}
              </button>
            </SectionCard>

            <SectionCard title="MVP acceptance checklist">
              <ul className="space-y-2 text-sm text-slate-700">
                <li>✓ Data-driven protocol nodes</li>
                <li>✓ Pure-ish decision transition handler</li>
                <li>✓ Tooth and canal tracking</li>
                <li>✓ Measurement panel</li>
                <li>✓ Difficulty flags and stop pathways</li>
                <li>✓ Event log</li>
                <li>✓ Compact note, full note, patient summary, JSON</li>
                <li>○ Full 99-step protocol encoding later</li>
                <li>○ Zod schemas/tests in repo implementation</li>
              </ul>
            </SectionCard>
          </aside>
        </main>
      </div>
    </div>
  );
}
