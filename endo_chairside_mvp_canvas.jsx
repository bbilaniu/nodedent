import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "endo-chairside-mvp-current-case";
const CASE_INDEX_KEY = "endo-chairside-mvp-case-index";
const CASE_RECORD_PREFIX = "endo-chairside-mvp-case-record:";

function makeCaseId(caseData) {
  const patient = String(caseData.patientNumber || "no-patient").trim() || "no-patient";
  const tooth = String(caseData.tooth || "unknown-tooth").trim() || "unknown-tooth";
  const procedure = String(caseData.procedureType || "RCT").trim() || "RCT";
  return `${patient}__${tooth}__${procedure}`.replaceAll(" ", "-");
}

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

const statusStyles = {
  notStarted: "bg-slate-100 text-slate-600 border-slate-200",
  scouted: "bg-blue-50 text-blue-800 border-blue-200",
  wlEstablished: "bg-violet-50 text-violet-800 border-violet-200",
  glidePath: "bg-cyan-50 text-cyan-800 border-cyan-200",
  shaped: "bg-emerald-50 text-emerald-800 border-emerald-200",
  disinfected: "bg-teal-50 text-teal-800 border-teal-200",
  complete: "bg-green-100 text-green-900 border-green-300",
  paused: "bg-slate-100 text-slate-700 border-slate-300",
  medicated: "bg-amber-50 text-amber-900 border-amber-200",
  referred: "bg-red-50 text-red-800 border-red-200",
};

const statusLabels = {
  notStarted: "Not started",
  scouted: "Scouted",
  wlEstablished: "WL established",
  glidePath: "Glide path",
  shaped: "Shaped",
  disinfected: "Disinfected",
  complete: "Complete",
  paused: "Paused",
  medicated: "Medicated",
  referred: "Referred",
};

const caseStatusOptions = [
  "RCT planned",
  "RCT initiated",
  "RCT completed",
  "Medicated and temporized",
  "Referred",
  "Resume next visit",
];

const phases = [
  "Pre-op",
  "Access",
  "Initial scouting",
  "Working length",
  "Glide path",
  "Shaping",
  "Smear / disinfection",
  "Obturation gauging",
  "Cone fit",
  "Sealer / cone seating",
  "Downpack / backfill",
  "Closure",
  "Troubleshooting",
  "Medication / temporisation",
  "Export",
];

const protocolNodes = {
  preop: {
    id: "preop",
    phase: "Pre-op",
    title: "Pre-op setup",
    chairsideInstruction: "Review pre-op radiographs and record chamber depth plus estimated WL for the active canal.",
    instruments: ["Pre-op PA/BW", "CBCT if available", "Rubber dam armamentarium"],
    requiredInputs: ["Tooth", "Procedure", "Chamber depth", "Estimated WL"],
    safetyNotes: ["Workflow/documentation aid only. Clinical judgment and referral thresholds still apply."],
    options: [{ label: "Pre-op review complete", nextNodeId: "access-chamber", noteEvent: { type: "preop.reviewCompleted" } }],
  },
  "access-chamber": {
    id: "access-chamber",
    phase: "Access",
    title: "Access pulp chamber",
    chairsideInstruction: "Mark 557 bur to the target vertical depth. Access toward the pulp chamber and rinse as needed.",
    instruments: ["557 bur", "Water rinse"],
    requiredInputs: ["Chamber depth"],
    safetyNotes: ["If marked depth is reached and chamber is not found, stop and reassess radiographically."],
    options: [
      { label: "Chamber reached", nextNodeId: "confirm-chamber", noteEvent: { type: "access.chamberReached" } },
      { label: "Marked depth reached but chamber not found", nextNodeId: "access-reassess", difficultyFlag: "caution", noteEvent: { type: "access.markedDepthNoChamber" } },
    ],
  },
  "access-reassess": {
    id: "access-reassess",
    phase: "Access",
    title: "Stop and reassess access direction",
    chairsideInstruction: "Capture BW/PA as appropriate, reassess orientation, and redirect only after radiographic/clinical review.",
    instruments: ["BW/PA radiograph", "DG16/17", "557 bur"],
    safetyNotes: ["Do not continue blindly beyond the marked depth."],
    options: [
      { label: "Radiograph taken and access redirected", nextNodeId: "access-chamber", noteEvent: { type: "access.radiographRedirected" } },
      { label: "Difficulty exceeds comfort", nextNodeId: "refer-pathway", difficultyFlag: "refer", noteEvent: { type: "difficulty.exceedsComfort" } },
    ],
  },
  "confirm-chamber": {
    id: "confirm-chamber",
    phase: "Access",
    title: "Confirm chamber access",
    chairsideInstruction: "Confirm chamber entry with a DG16/17 endodontic explorer.",
    instruments: ["DG16/17 Endo Explorer"],
    options: [
      { label: "Pulp chamber confirmed", nextNodeId: "refine-access", noteEvent: { type: "access.chamberConfirmed" } },
      { label: "Chamber not confirmed", nextNodeId: "access-reassess", difficultyFlag: "caution", noteEvent: { type: "access.chamberNotConfirmed" } },
    ],
  },
  "refine-access": {
    id: "refine-access",
    phase: "Access",
    title: "Refine access outline",
    chairsideInstruction: "Refine access outline with Endo-Z bur and rinse as needed.",
    instruments: ["Endo-Z bur", "Water rinse"],
    options: [{ label: "Access refined", nextNodeId: "identify-canals", noteEvent: { type: "access.refined" } }],
  },
  "identify-canals": {
    id: "identify-canals",
    phase: "Access",
    title: "Identify canals",
    chairsideInstruction: "Identify canals with DG16/17 explorer. Add or rename canals in the canal panel.",
    instruments: ["DG16/17 Endo Explorer"],
    requiredInputs: ["At least one canal name"],
    options: [{ label: "Canals identified", nextNodeId: "estimate-wl", noteEvent: { type: "access.canalsIdentified" } }],
  },
  "estimate-wl": {
    id: "estimate-wl",
    phase: "Initial scouting",
    title: "Estimate working length",
    chairsideInstruction: "Estimate WL from pre-op PA and set the 10C file stopper for the active canal.",
    instruments: ["Pre-op PA", "10C hand file"],
    requiredInputs: ["Estimated WL for active canal"],
    options: [{ label: "10C stopper set to estimated WL", nextNodeId: "advance-10c", noteEvent: { type: "scouting.estimatedWLSet" } }],
  },
  "advance-10c": {
    id: "advance-10c",
    phase: "Initial scouting",
    title: "Advance 10C to passive resistance",
    chairsideInstruction: "Place lubricant or aqueous irrigation. Advance 10C to passive resistance without exceeding estimated WL.",
    instruments: ["10C hand file"],
    materials: ["File lubricant or aqueous irrigation"],
    requiredInputs: ["Estimated WL", "10C terminal length if short"],
    safetyNotes: ["Do not exceed estimated WL."],
    options: [
      { label: "10C reached estimated WL", nextNodeId: "open-orifice", noteEvent: { type: "scouting.estimatedWLReached" } },
      { label: "10C stopped short", nextNodeId: "measure-available-space", noteEvent: { type: "scouting.fileStoppedShort" } },
    ],
  },
  "measure-available-space": {
    id: "measure-available-space",
    phase: "Initial scouting",
    title: "Measure available treatment space",
    chairsideInstruction: "With 10C at terminal position, adjust stopper to a reproducible reference point, remove, and measure available treatment space.",
    instruments: ["10C hand file", "Endo ruler"],
    requiredInputs: ["Available treatment space", "Reference point"],
    options: [
      { label: "Available treatment space >16 mm", nextNodeId: "open-orifice", difficultyFlag: "caution", noteEvent: { type: "scouting.availableSpaceGreaterThan16" } },
      { label: "Available treatment space ≤16 mm", nextNodeId: "limited-space-warning", difficultyFlag: "high", noteEvent: { type: "scouting.availableSpaceLimited" } },
    ],
  },
  "limited-space-warning": {
    id: "limited-space-warning",
    phase: "Troubleshooting",
    title: "Limited treatment space warning",
    chairsideInstruction: "Available treatment space is ≤16 mm. Case difficulty increases significantly.",
    safetyNotes: ["Consider staged care, CBCT review, magnification, or referral."],
    options: [
      { label: "Proceed with extreme caution", nextNodeId: "open-orifice", difficultyFlag: "high", noteEvent: { type: "difficulty.proceededWithExtremeCaution" } },
      { label: "Medicate and temporize", nextNodeId: "calcium-hydroxide", difficultyFlag: "refer", noteEvent: { type: "treatment.medicateTemporizeSelected" } },
      { label: "Refer", nextNodeId: "refer-pathway", difficultyFlag: "refer", noteEvent: { type: "treatment.referralSelected" } },
    ],
  },
  "open-orifice": {
    id: "open-orifice",
    phase: "Working length",
    title: "Open canal orifice",
    chairsideInstruction: "Open canal orifice with an orifice opener. Do not exceed 15 mm. Irrigate with diluted NaOCl.",
    instruments: ["Orifice opener file"],
    materials: ["Diluted NaOCl"],
    safetyNotes: ["Do not exceed 15 mm with the orifice opener."],
    options: [{ label: "Orifice opened and irrigated", nextNodeId: "dry-canal", noteEvent: { type: "orifice.opened" } }],
  },
  "dry-canal": {
    id: "dry-canal",
    phase: "Working length",
    title: "Dry canal for EAL",
    chairsideInstruction: "Dry canal with measured paper points before electronic working length.",
    instruments: ["25/.04 paper points"],
    options: [
      { label: "Canal dried", nextNodeId: "attach-eal", noteEvent: { type: "canal.driedForEAL" } },
      { label: "Canal remains wet", nextNodeId: "persistent-wet", difficultyFlag: "high", noteEvent: { type: "drying.persistentWetBeforeEAL" } },
    ],
  },
  "attach-eal": {
    id: "attach-eal",
    phase: "Working length",
    title: "Attach EAL to 10C file",
    chairsideInstruction: "Attach EAL to 10C hand file and attempt to establish electronic WL.",
    instruments: ["EAL", "10C hand file"],
    options: [
      { label: "EAL signals patency", nextNodeId: "establish-eal0", noteEvent: { type: "workingLength.ealPatencySignal" } },
      { label: "EAL reads short at terminal length", nextNodeId: "file-stop-vs-resistance", difficultyFlag: "caution", noteEvent: { type: "workingLength.ealReadsShort" } },
    ],
  },
  "file-stop-vs-resistance": {
    id: "file-stop-vs-resistance",
    phase: "Troubleshooting",
    title: "File resistance vs file stop",
    chairsideInstruction: "Determine whether the 10C is encountering file resistance or a file stop.",
    options: [
      { label: "File resistance", nextNodeId: "middle-third-guide-path", difficultyFlag: "caution", noteEvent: { type: "troubleshooting.fileResistance" } },
      { label: "File stop", nextNodeId: "prebend-10c", difficultyFlag: "high", noteEvent: { type: "troubleshooting.fileStop" } },
      { label: "Difficulty exceeds comfort", nextNodeId: "refer-pathway", difficultyFlag: "refer", noteEvent: { type: "difficulty.exceedsComfort" } },
    ],
  },
  "prebend-10c": {
    id: "prebend-10c",
    phase: "Troubleshooting",
    title: "Pre-bend 10C file",
    chairsideInstruction: "Place lubricant or aqueous irrigation. Use file bending technique with 10C and reassess advancement.",
    instruments: ["10C hand file"],
    materials: ["File lubricant or aqueous irrigation"],
    options: [
      { label: "File advances", nextNodeId: "dry-canal", noteEvent: { type: "troubleshooting.prebendFileAdvanced" } },
      { label: "File does not advance", nextNodeId: "limited-space-warning", difficultyFlag: "high", noteEvent: { type: "troubleshooting.prebendFailed" } },
    ],
  },
  "middle-third-guide-path": {
    id: "middle-third-guide-path",
    phase: "Troubleshooting",
    title: "Open middle third",
    chairsideInstruction: "Open middle third with guide path file to resistance. Do not exceed available treatment space.",
    instruments: ["Guide path file"],
    materials: ["File lubricant or aqueous irrigation", "Diluted NaOCl"],
    safetyNotes: ["Do not exceed available treatment space."],
    options: [
      { label: "Middle third opened and irrigated", nextNodeId: "dry-canal", noteEvent: { type: "troubleshooting.middleThirdOpened" } },
      { label: "Cannot safely advance", nextNodeId: "refer-pathway", difficultyFlag: "refer", noteEvent: { type: "troubleshooting.middleThirdNotSafe" } },
    ],
  },
  "establish-eal0": {
    id: "establish-eal0",
    phase: "Working length",
    title: "Establish EAL 0",
    chairsideInstruction: "Adjust 10C until EAL reads 0. Capture WL radiograph and record EAL 0, patency length, shaping length, and reference point.",
    instruments: ["EAL", "10C hand file", "WL radiograph"],
    requiredInputs: ["EAL 0", "Patency length", "Shaping length", "Reference point"],
    options: [{ label: "EAL 0 recorded and WL radiograph taken", nextNodeId: "patency-10c", noteEvent: { type: "workingLength.established" } }],
  },
  "patency-10c": {
    id: "patency-10c",
    phase: "Glide path",
    title: "10C to patency length until super loose",
    chairsideInstruction: "Measure 10C to patency length. Work in filing/reciprocating motion until super loose. Irrigate.",
    instruments: ["10C hand file"],
    materials: ["Diluted NaOCl", "File lubricant or aqueous irrigation"],
    requiredInputs: ["Patency length"],
    options: [
      { label: "10C achieved patency length and is super loose", nextNodeId: "guide-path", noteEvent: { type: "glidePath.patencyAchieved" } },
      { label: "10C stops short of patency length", nextNodeId: "prebend-10c", difficultyFlag: "high", noteEvent: { type: "glidePath.patencyShort" } },
    ],
  },
  "guide-path": {
    id: "guide-path",
    phase: "Glide path",
    title: "Create guide path",
    chairsideInstruction: "Measure guide path file to EAL 0 and advance. Irrigate after use.",
    instruments: ["Guide path file"],
    materials: ["Diluted NaOCl"],
    requiredInputs: ["EAL 0 / guide path length"],
    options: [
      { label: "Guide path file reached EAL 0", nextNodeId: "gauge-final-shape", noteEvent: { type: "glidePath.created" } },
      { label: "Guide path file did not reach EAL 0", nextNodeId: "patency-10c", difficultyFlag: "caution", noteEvent: { type: "glidePath.fileShort" } },
    ],
  },
  "gauge-final-shape": {
    id: "gauge-final-shape",
    phase: "Shaping",
    title: "Gauge for final shape",
    chairsideInstruction: "Set 25 NiTi hand file to shaping length. Advance and assess resistance. If it reaches length with no resistance, sequentially gauge larger NiTi hand files before selecting the final .04 rotary shape. If it reaches within 0 to 2 mm with resistance, proceed to final .04 shaping.",
    instruments: ["25 NiTi hand file", "Sequentially larger NiTi hand files"],
    requiredInputs: ["Shaping length"],
    options: [
      { label: "25 NiTi reaches shaping length with no resistance", nextNodeId: "increase-shaping-gauge", noteEvent: { type: "shaping.gaugeNoResistance" } },
      { label: "NiTi reaches within 0 to 2 mm with resistance", nextNodeId: "create-final-shape", difficultyFlag: "caution", noteEvent: { type: "shaping.gaugeResistanceNearLength" } },
      { label: "NiTi more than 2 mm short", nextNodeId: "patency-10c", difficultyFlag: "high", noteEvent: { type: "shaping.gaugeMoreThan2mmShort" } },
    ],
  },
  "increase-shaping-gauge": {
    id: "increase-shaping-gauge",
    phase: "Shaping",
    title: "Increase NiTi hand-file gauge",
    chairsideInstruction: "Use the next size NiTi hand file at shaping length. Continue increasing one ISO size at a time until the next larger file no longer reaches shaping length or has clear binding/resistance. Record the largest size that predictably reaches shaping length as the final apical gauge, then choose the matching .04 engine-driven file.",
    instruments: ["Sequential NiTi hand files"],
    requiredInputs: ["Shaping length", "Final shape"],
    options: [
      { label: "Next larger NiTi reaches shaping length; continue gauging", nextNodeId: "increase-shaping-gauge", noteEvent: { type: "shaping.nextGaugeReachedLength" } },
      { label: "Next larger NiTi binds / does not reach shaping length", nextNodeId: "create-final-shape", noteEvent: { type: "shaping.finalGaugeSelected" } },
      { label: "Cannot safely increase gauge", nextNodeId: "patency-10c", difficultyFlag: "high", noteEvent: { type: "shaping.gaugeIncreaseUnsafe" } },
    ],
  },
  "create-final-shape": {
    id: "create-final-shape",
    phase: "Shaping",
    title: "Create final .04 shape",
    chairsideInstruction: "Choose matching .04 engine-driven file. Set stopper to shaping length and advance to shaping length.",
    instruments: [".04 tapered engine-driven file"],
    requiredInputs: ["Final shape"],
    options: [
      { label: ".04 file reached shaping length", nextNodeId: "irrigate-recapitulate", noteEvent: { type: "shaping.finalShapeAchieved" } },
      { label: ".04 file did not reach shaping length", nextNodeId: "patency-10c", difficultyFlag: "caution", noteEvent: { type: "shaping.finalShapeShort" } },
    ],
  },
  "irrigate-recapitulate": {
    id: "irrigate-recapitulate",
    phase: "Shaping",
    title: "Irrigate and recapitulate",
    chairsideInstruction: "Irrigate with NaOCl. Recapitulate with 10C to patency length until super loose.",
    instruments: ["10C hand file", "Irrigation syringe"],
    materials: ["NaOCl"],
    options: [
      { label: "Canal shaped and recapitulated", nextNodeId: "remove-smear-layer", noteEvent: { type: "shaping.completed" } },
      { label: "Canal remains wet / cannot complete today", nextNodeId: "persistent-wet", difficultyFlag: "high", noteEvent: { type: "drying.persistentWetAfterShaping" } },
      { label: "Medicate and temporize", nextNodeId: "calcium-hydroxide", noteEvent: { type: "treatment.medicateTemporizeSelected" } },
    ],
  },
  "remove-smear-layer": {
    id: "remove-smear-layer",
    phase: "Smear / disinfection",
    title: "Remove smear layer",
    chairsideInstruction: "Irrigate with 17% EDTA. Ideal canal exposure to EDTA is 90 to 120 seconds.",
    materials: ["17% EDTA"],
    requiredInputs: ["Shaping length", "Final shape"],
    safetyNotes: ["Do not proceed to final disinfection until shaping is complete and canal length data are recorded."],
    options: [
      { label: "17% EDTA placed for 90 to 120 seconds", nextNodeId: "agitate-edta", noteEvent: { type: "smearLayer.edtaPlaced" } },
      { label: "Canal cannot be completed today", nextNodeId: "calcium-hydroxide", difficultyFlag: "high", noteEvent: { type: "smearLayer.deferred" } },
    ],
  },
  "agitate-edta": {
    id: "agitate-edta",
    phase: "Smear / disinfection",
    title: "Agitate EDTA",
    chairsideInstruction: "Agitate EDTA with a measured 30/.04 GP cone at shaping length using a 2 to 3 mm pumping motion. Do not exceed shaping length.",
    instruments: ["30/.04 GP cone"],
    materials: ["17% EDTA"],
    requiredInputs: ["Shaping length"],
    safetyNotes: ["Do not exceed shaping length during agitation."],
    options: [
      { label: "EDTA agitated without exceeding shaping length", nextNodeId: "final-naocl", noteEvent: { type: "smearLayer.edtaAgitated" } },
      { label: "Unable to agitate predictably", nextNodeId: "calcium-hydroxide", difficultyFlag: "high", noteEvent: { type: "smearLayer.agitationDeferred" } },
    ],
  },
  "final-naocl": {
    id: "final-naocl",
    phase: "Smear / disinfection",
    title: "Final NaOCl disinfection",
    chairsideInstruction: "Irrigate with concentrated NaOCl and leave it in the canal for final disinfection before obturation gauging.",
    materials: ["Concentrated NaOCl"],
    options: [
      { label: "Final NaOCl disinfection completed", nextNodeId: "ready-for-obturation", noteEvent: { type: "disinfection.finalNaOClCompleted" } },
      { label: "Canal remains wet / cannot complete today", nextNodeId: "persistent-wet", difficultyFlag: "high", noteEvent: { type: "disinfection.cannotCompleteToday" } },
    ],
  },
  "ready-for-obturation": {
    id: "ready-for-obturation",
    phase: "Smear / disinfection",
    title: "Ready for obturation gauging",
    chairsideInstruction: "Smear layer removal and final disinfection are complete. Proceed to obturation gauging.",
    options: [
      { label: "Proceed to obturation gauging", nextNodeId: "gauge-obturation-30", noteEvent: { type: "disinfection.readyForObturation" } },
    ],
  },
  "gauge-obturation-30": {
    id: "gauge-obturation-30",
    phase: "Obturation gauging",
    title: "Gauge obturation with size 30 NiTi",
    chairsideInstruction: "Set size 30 NiTi hand file to shaping length. Advance to shaping length and apply firm apical pressure.",
    instruments: ["Size 30 NiTi hand file"],
    requiredInputs: ["Shaping length"],
    options: [
      { label: "Size 30 reaches shaping length and does not advance beyond", nextNodeId: "record-obturation-gauge", noteEvent: { type: "obturationGauge.size30Stop" } },
      { label: "Size 30 reaches shaping length and advances beyond", nextNodeId: "gauge-obturation-larger", difficultyFlag: "caution", noteEvent: { type: "obturationGauge.size30AdvancesBeyond" } },
      { label: "Size 30 does not reach shaping length", nextNodeId: "gauge-obturation-25", difficultyFlag: "caution", noteEvent: { type: "obturationGauge.size30Short" } },
    ],
  },
  "gauge-obturation-25": {
    id: "gauge-obturation-25",
    phase: "Obturation gauging",
    title: "Gauge obturation with size 25 NiTi",
    chairsideInstruction: "Set size 25 NiTi hand file to shaping length. Advance to shaping length and apply firm apical pressure.",
    instruments: ["Size 25 NiTi hand file"],
    requiredInputs: ["Shaping length"],
    options: [
      { label: "Size 25 reaches shaping length and does not advance beyond", nextNodeId: "record-obturation-gauge", noteEvent: { type: "obturationGauge.size25Stop" } },
      { label: "Size 25 reaches shaping length and advances beyond", nextNodeId: "gauge-obturation-larger", difficultyFlag: "caution", noteEvent: { type: "obturationGauge.size25AdvancesBeyond" } },
      { label: "Size 25 does not reach shaping length", nextNodeId: "patency-10c", difficultyFlag: "high", noteEvent: { type: "obturationGauge.size25Short" } },
    ],
  },
  "gauge-obturation-larger": {
    id: "gauge-obturation-larger",
    phase: "Obturation gauging",
    title: "Gauge with next larger NiTi file",
    chairsideInstruction: "Set the next successively larger NiTi hand file to shaping length. Advance and apply firm apical pressure until a size reaches shaping length and does not advance beyond.",
    instruments: ["NiTi hand files"],
    requiredInputs: ["Obturation gauge size"],
    options: [
      { label: "Larger NiTi size stops at shaping length", nextNodeId: "record-obturation-gauge", noteEvent: { type: "obturationGauge.largerSizeStop" } },
      { label: "Larger NiTi continues to advance beyond", nextNodeId: "gauge-obturation-larger", difficultyFlag: "caution", noteEvent: { type: "obturationGauge.largerSizeAdvancesBeyond" } },
    ],
  },
  "record-obturation-gauge": {
    id: "record-obturation-gauge",
    phase: "Obturation gauging",
    title: "Record obturation gauge",
    chairsideInstruction: "Record the NiTi hand file size that achieved shaping length and did not advance beyond under firm apical pressure.",
    requiredInputs: ["Obturation gauge size"],
    options: [{ label: "Obturation gauge recorded", nextNodeId: "fit-master-cone", noteEvent: { type: "obturationGauge.recorded" } }],
  },
  "fit-master-cone": {
    id: "fit-master-cone",
    phase: "Cone fit",
    title: "Fit .04 tapered master cone",
    chairsideInstruction: "Choose a .04 tapered GP cone matching the recorded obturation gauge size. Measure to shaping length and place to shaping length.",
    instruments: [".04 tapered GP cone"],
    requiredInputs: ["Master cone", "Shaping length"],
    options: [
      { label: "Master cone fits to shaping length", nextNodeId: "cone-fit-radiograph", noteEvent: { type: "coneFit.masterConeFits" } },
      { label: "Master cone is short", nextNodeId: "cone-short", difficultyFlag: "caution", noteEvent: { type: "coneFit.masterConeShort" } },
      { label: "Master cone is long", nextNodeId: "cone-long", difficultyFlag: "caution", noteEvent: { type: "coneFit.masterConeLong" } },
    ],
  },
  "cone-short": {
    id: "cone-short",
    phase: "Cone fit",
    title: "Master cone short",
    chairsideInstruction: "Try a .04 tapered GP cone one size smaller. If the smaller cone still does not reach shaping length, return to final shaping.",
    instruments: ["One-size-smaller .04 GP cone"],
    options: [
      { label: "Smaller cone fits to shaping length", nextNodeId: "cone-fit-radiograph", noteEvent: { type: "coneFit.smallerConeFits" } },
      { label: "Smaller cone still short", nextNodeId: "create-final-shape", difficultyFlag: "high", noteEvent: { type: "coneFit.smallerConeStillShort" } },
      { label: "Smaller cone is long", nextNodeId: "cone-long", difficultyFlag: "caution", noteEvent: { type: "coneFit.smallerConeLong" } },
    ],
  },
  "cone-long": {
    id: "cone-long",
    phase: "Cone fit",
    title: "Master cone long",
    chairsideInstruction: "Crimp the engaged cone at the reference point, remove and measure it, subtract shaping length, trim excess, and retry cone fit.",
    instruments: ["Locking cotton forceps", "Endo ruler", "Scissors"],
    requiredInputs: ["Master cone", "Shaping length", "Reference point"],
    options: [
      { label: "Cone trimmed and now fits shaping length", nextNodeId: "cone-fit-radiograph", noteEvent: { type: "coneFit.trimmedConeFits" } },
      { label: "Trimmed cone still does not fit", nextNodeId: "cone-short", difficultyFlag: "caution", noteEvent: { type: "coneFit.trimmedConeStillNotFit" } },
      { label: "Cone remains long after trimming", nextNodeId: "cone-long", difficultyFlag: "caution", noteEvent: { type: "coneFit.coneStillLong" } },
    ],
  },
  "cone-fit-radiograph": {
    id: "cone-fit-radiograph",
    phase: "Cone fit",
    title: "Confirm cone fit radiographically",
    chairsideInstruction: "Confirm master cone fit with a periapical radiograph. Record cone fit status before removing the cone and setting it aside for later use.",
    instruments: ["PA radiograph"],
    requiredInputs: ["Cone fit radiograph status"],
    options: [
      { label: "Cone fit radiograph acceptable", nextNodeId: "dry-for-obturation", noteEvent: { type: "coneFit.radiographAcceptable" } },
      { label: "Cone fit radiograph short", nextNodeId: "cone-short", difficultyFlag: "caution", noteEvent: { type: "coneFit.radiographShort" } },
      { label: "Cone fit radiograph long", nextNodeId: "cone-long", difficultyFlag: "caution", noteEvent: { type: "coneFit.radiographLong" } },
    ],
  },
  "dry-for-obturation": {
    id: "dry-for-obturation",
    phase: "Sealer / cone seating",
    title: "Dry canal for obturation",
    chairsideInstruction: "Dry the canal with measured 25/.04 paper points to shaping length. Larger paper points may be used initially, but final drying should be honed with 25/.04 paper points.",
    instruments: ["25/.04 paper points"],
    requiredInputs: ["Shaping length", "Drying status"],
    options: [
      { label: "Paper point dry or slightly damp", nextNodeId: "patency-before-sealer", noteEvent: { type: "drying.readyForSealer" } },
      { label: "Paper point wet", nextNodeId: "dry-for-obturation", difficultyFlag: "caution", noteEvent: { type: "drying.paperPointWet" } },
      { label: "Paper point remains wet after several attempts", nextNodeId: "calcium-hydroxide", difficultyFlag: "high", noteEvent: { type: "drying.persistentWetBeforeObturation" } },
    ],
  },
  "patency-before-sealer": {
    id: "patency-before-sealer",
    phase: "Sealer / cone seating",
    title: "Confirm patency before sealer",
    chairsideInstruction: "Measure 10C hand file to patency length and work at patency length until super loose before sealer placement.",
    instruments: ["10C hand file"],
    requiredInputs: ["Patency length"],
    options: [
      { label: "10C super loose at patency length", nextNodeId: "apply-sealer", noteEvent: { type: "sealer.patencyConfirmed" } },
      { label: "10C does not reach patency length", nextNodeId: "prebend-10c", difficultyFlag: "high", noteEvent: { type: "sealer.patencyNotConfirmed" } },
    ],
  },
  "apply-sealer": {
    id: "apply-sealer",
    phase: "Sealer / cone seating",
    title: "Apply sealer into canal",
    chairsideInstruction: "Place White NaviTip on injectable bioceramic sealer. Measure NaviTip to 15 mm, place passively, and inject while withdrawing coronally. Do not bind the NaviTip. If shaping length is <18 mm, do not advance NaviTip into the last 3 mm of the prepared canal.",
    instruments: ["White NaviTip", "Injectable bioceramic sealer"],
    materials: ["Bioceramic sealer"],
    safetyNotes: ["Do not bind the White NaviTip in the canal.", "For shaping lengths <18 mm, do not advance into the last 3 mm of the prepared canal."],
    options: [
      { label: "Sealer applied with passive NaviTip withdrawal", nextNodeId: "paper-point-through-sealer", noteEvent: { type: "sealer.applied" } },
      { label: "NaviTip binds / cannot place safely", nextNodeId: "calcium-hydroxide", difficultyFlag: "high", noteEvent: { type: "sealer.naviTipUnsafe" } },
    ],
  },
  "paper-point-through-sealer": {
    id: "paper-point-through-sealer",
    phase: "Sealer / cone seating",
    title: "Paper point through sealer",
    chairsideInstruction: "Measure 25/.04 paper point to shaping length and advance through the applied sealer to shaping length.",
    instruments: ["25/.04 paper point"],
    requiredInputs: ["Shaping length"],
    options: [
      { label: "Paper point passed through sealer to shaping length", nextNodeId: "reapply-sealer", noteEvent: { type: "sealer.paperPointDistributed" } },
      { label: "Paper point does not reach shaping length", nextNodeId: "patency-before-sealer", difficultyFlag: "caution", noteEvent: { type: "sealer.paperPointShort" } },
    ],
  },
  "reapply-sealer": {
    id: "reapply-sealer",
    phase: "Sealer / cone seating",
    title: "Re-apply sealer into canal",
    chairsideInstruction: "Re-apply bioceramic sealer with White NaviTip to 15 mm passively while withdrawing coronally. Again, do not bind the NaviTip.",
    instruments: ["White NaviTip", "Injectable bioceramic sealer"],
    materials: ["Bioceramic sealer"],
    safetyNotes: ["Do not bind the White NaviTip in the canal."],
    options: [
      { label: "Sealer re-applied", nextNodeId: "seat-gp-cone", noteEvent: { type: "sealer.reapplied" } },
      { label: "Cannot re-apply sealer safely", nextNodeId: "calcium-hydroxide", difficultyFlag: "high", noteEvent: { type: "sealer.reapplyUnsafe" } },
    ],
  },
  "seat-gp-cone": {
    id: "seat-gp-cone",
    phase: "Sealer / cone seating",
    title: "Seat pre-fit GP cone",
    chairsideInstruction: "Advance the pre-fit .04 tapered gutta-percha cone into the canal to shaping length.",
    instruments: ["Pre-fit .04 tapered GP cone"],
    requiredInputs: ["Master cone", "Shaping length"],
    options: [
      { label: "GP cone seats at shaping length", nextNodeId: "evaluate-orifice-gap", noteEvent: { type: "gpSeating.coneSeated" } },
      { label: "GP cone does not seat to shaping length", nextNodeId: "patency-before-sealer", difficultyFlag: "caution", noteEvent: { type: "gpSeating.coneShortAfterSealer" } },
      { label: "GP cone advances beyond shaping length", nextNodeId: "gauge-obturation-30", difficultyFlag: "high", noteEvent: { type: "gpSeating.coneLongAfterSealer" } },
    ],
  },
  "evaluate-orifice-gap": {
    id: "evaluate-orifice-gap",
    phase: "Downpack / backfill",
    title: "Evaluate orifice gap space",
    chairsideInstruction: "Evaluate visible orifice gap space after GP cone seating. Decide whether the orifice is round, ovoid, or has no visible gap.",
    options: [
      { label: "No visible gap space", nextNodeId: "sear-gp-cones", noteEvent: { type: "downpack.noGapSpace" } },
      { label: "Gap space in round orifice", nextNodeId: "modified-downpack", noteEvent: { type: "downpack.roundGapSpace" } },
      { label: "Gap space in ovoid orifice", nextNodeId: "add-accessory-cones", noteEvent: { type: "downpack.ovoidGapSpace" } },
    ],
  },
  "modified-downpack": {
    id: "modified-downpack",
    phase: "Downpack / backfill",
    title: "Modified GP downpack",
    chairsideInstruction: "Measure heat plugger to 15 mm. Activate heat source and advance to the reference level. Deactivate for 5 seconds, then reactivate and remove plugger.",
    instruments: ["Electric heat source", "Heat plugger"],
    safetyNotes: ["Consider radiograph if cone movement or placement is uncertain."],
    options: [
      { label: "Coronal GP removed and apical GP stayed in place", nextNodeId: "reapply-sealer-on-gp", noteEvent: { type: "downpack.modifiedSuccessful" } },
      { label: "Little or no GP removed", nextNodeId: "modified-downpack", difficultyFlag: "caution", noteEvent: { type: "downpack.littleGpRemoved" } },
      { label: "Cone moved or was removed", nextNodeId: "fit-master-cone", difficultyFlag: "high", noteEvent: { type: "downpack.coneMoved" } },
    ],
  },
  "add-accessory-cones": {
    id: "add-accessory-cones",
    phase: "Downpack / backfill",
    title: "Add accessory GP cones",
    chairsideInstruction: "Place additional 25/.04 GP cones into visible gap spaces as needed until no visible gap remains.",
    instruments: ["25/.04 GP cones"],
    options: [
      { label: "Accessory cones added; no visible gap remains", nextNodeId: "sear-gp-cones", noteEvent: { type: "downpack.accessoryConesAdded" } },
      { label: "Cannot fill gap predictably", nextNodeId: "modified-downpack", difficultyFlag: "caution", noteEvent: { type: "downpack.accessoryConeDifficulty" } },
    ],
  },
  "sear-gp-cones": {
    id: "sear-gp-cones",
    phase: "Downpack / backfill",
    title: "Sear GP cones",
    chairsideInstruction: "Use electric heat source and heat plugger to heat-sear GP cone(s) at and above the canal orifice.",
    instruments: ["Electric heat source", "Heat plugger"],
    options: [{ label: "GP cone(s) seared at orifice", nextNodeId: "vertical-compaction", noteEvent: { type: "downpack.gpSeared" } }],
  },
  "vertical-compaction": {
    id: "vertical-compaction",
    phase: "Downpack / backfill",
    title: "Light vertical compaction",
    chairsideInstruction: "Use an endodontic plugger to apply light vertical compaction force on remaining GP in the canal.",
    instruments: ["Endodontic plugger"],
    options: [
      { label: "GP maintained position", nextNodeId: "canal-obturation-complete", noteEvent: { type: "downpack.gpStableAfterCompaction" } },
      { label: "GP moved apically", nextNodeId: "reapply-sealer-on-gp", difficultyFlag: "caution", noteEvent: { type: "downpack.gpMovedApically" } },
    ],
  },
  "reapply-sealer-on-gp": {
    id: "reapply-sealer-on-gp",
    phase: "Downpack / backfill",
    title: "Re-apply sealer over visible GP",
    chairsideInstruction: "Place a small amount of bioceramic sealer on top of the visible GP before backfill.",
    materials: ["Bioceramic sealer"],
    options: [{ label: "Sealer applied over visible GP", nextNodeId: "backfill-canal", noteEvent: { type: "backfill.sealerOnGp" } }],
  },
  "backfill-canal": {
    id: "backfill-canal",
    phase: "Downpack / backfill",
    title: "Backfill remaining canal space",
    chairsideInstruction: "Allow thermoplastic GP delivery system to reach full temperature. Seat tip on remaining GP for 5 seconds, inject thermoplastic GP, and allow passive withdrawal.",
    instruments: ["Thermoplastic GP delivery system"],
    materials: ["Thermoplastic GP"],
    options: [
      { label: "Backfill completed", nextNodeId: "compact-backfill", noteEvent: { type: "backfill.completed" } },
      { label: "Backfill not predictable", nextNodeId: "reapply-sealer-on-gp", difficultyFlag: "caution", noteEvent: { type: "backfill.difficulty" } },
    ],
  },
  "compact-backfill": {
    id: "compact-backfill",
    phase: "Downpack / backfill",
    title: "Compact injected GP",
    chairsideInstruction: "Apply light vertical compaction force on injected GP. If plugger pokes holes, increase plugger size and repeat backfill if needed.",
    instruments: ["Endodontic plugger"],
    options: [
      { label: "GP remains at canal orifice", nextNodeId: "canal-obturation-complete", noteEvent: { type: "backfill.compactedStable" } },
      { label: "GP moves apically", nextNodeId: "reapply-sealer-on-gp", difficultyFlag: "caution", noteEvent: { type: "backfill.gpMovedApically" } },
      { label: "Excess GP extends into chamber", nextNodeId: "canal-obturation-complete", noteEvent: { type: "backfill.excessInChamber" } },
      { label: "Plugger pokes holes", nextNodeId: "backfill-canal", difficultyFlag: "caution", noteEvent: { type: "backfill.pluggerHoles" } },
    ],
  },
  "canal-obturation-complete": {
    id: "canal-obturation-complete",
    phase: "Downpack / backfill",
    title: "Active canal obturation complete",
    chairsideInstruction: "The active canal has been obturated/backfilled. If other canals still require treatment, continue another canal before final chamber cleanup and restoration. Proceed to chamber cleanup only when all canals are ready.",
    options: [
      { label: "All canals obturated; proceed to chamber cleanup", nextNodeId: "cleanup-chamber", noteEvent: { type: "workflow.allCanalsReadyForClosure" } },
    ],
  },
  "cleanup-chamber": {
    id: "cleanup-chamber",
    phase: "Closure",
    title: "Clean pulp chamber",
    chairsideInstruction: "Remove residual GP from the pulp chamber with a small spoon excavator and electric heat source as needed.",
    instruments: ["Small spoon excavator", "Electric heat source"],
    options: [{ label: "Residual GP removed from chamber", nextNodeId: "rinse-chamber", noteEvent: { type: "closure.chamberGpRemoved" } }],
  },
  "rinse-chamber": {
    id: "rinse-chamber",
    phase: "Closure",
    title: "Rinse pulp chamber",
    chairsideInstruction: "Rinse the pulp chamber with water until residual sealer is removed.",
    materials: ["Water rinse"],
    options: [{ label: "Chamber rinsed clean", nextNodeId: "close-access", noteEvent: { type: "closure.chamberRinsed" } }],
  },
  "close-access": {
    id: "close-access",
    phase: "Closure",
    title: "Close access",
    chairsideInstruction: "Close the access using the selected closure method.",
    materials: ["Sponge", "Temporary restorative material", "Orifice barrier", "Final restorative material"],
    options: [
      { label: "Sponge and temporary restoration placed", nextNodeId: "mvp-complete", noteEvent: { type: "closure.temporary" } },
      { label: "Orifice barrier and temporary restoration placed", nextNodeId: "mvp-complete", noteEvent: { type: "closure.orificeBarrierTemporary" } },
      { label: "Final restoration placed", nextNodeId: "mvp-complete", noteEvent: { type: "closure.finalRestoration" } },
    ],
  },
  "persistent-wet": {
    id: "persistent-wet",
    phase: "Troubleshooting",
    title: "Persistent wet canal",
    chairsideInstruction: "Repeat drying with measured paper points. If still wet, place calcium hydroxide and temporize.",
    instruments: ["25/.04 paper points", "White NaviTip"],
    materials: ["Calcium hydroxide", "Temporary restorative material"],
    options: [
      { label: "Canal dried", nextNodeId: "attach-eal", noteEvent: { type: "drying.canalDriedAfterRepeat" } },
      { label: "Persistent wet canal · place calcium hydroxide", nextNodeId: "calcium-hydroxide", difficultyFlag: "high", noteEvent: { type: "drying.persistentWetConfirmed" } },
    ],
  },
  "calcium-hydroxide": {
    id: "calcium-hydroxide",
    phase: "Medication / temporisation",
    title: "Place calcium hydroxide",
    chairsideInstruction: "Place calcium hydroxide with White NaviTip. Proceed to temporary closure.",
    instruments: ["White NaviTip"],
    materials: ["Calcium hydroxide"],
    options: [{ label: "Calcium hydroxide placed", nextNodeId: "temporary-closure", noteEvent: { type: "medication.calciumHydroxidePlaced" } }],
  },
  "temporary-closure": {
    id: "temporary-closure",
    phase: "Medication / temporisation",
    title: "Temporary closure",
    chairsideInstruction: "Close access with sponge and temporary restorative material.",
    materials: ["Sponge", "Temporary restorative material"],
    options: [{ label: "Access temporized", nextNodeId: "mvp-complete", noteEvent: { type: "closure.temporary" } }],
  },
  "refer-pathway": {
    id: "refer-pathway",
    phase: "Medication / temporisation",
    title: "Referral / stop pathway",
    chairsideInstruction: "Document difficulty and consider medication/temporization or referral.",
    safetyNotes: ["Referral is appropriate when treatment exceeds comfort, skill, equipment, or case difficulty limits."],
    options: [
      { label: "Document referral recommended", nextNodeId: "mvp-complete", difficultyFlag: "refer", noteEvent: { type: "treatment.referralRecommended" } },
      { label: "Medicate and temporize instead", nextNodeId: "calcium-hydroxide", difficultyFlag: "refer", noteEvent: { type: "treatment.medicateTemporizeSelected" } },
    ],
  },
  "mvp-complete": {
    id: "mvp-complete",
    phase: "Export",
    title: "MVP pathway complete",
    chairsideInstruction: "This pathway has enough structured data to generate note outputs. Continue another canal, undo, or copy the note.",
    options: [
      { label: "Return to pre-op", nextNodeId: "preop", noteEvent: { type: "workflow.returnedToStart" } },
    ],
  },
};

const handoffNodeIds = new Set([
  "ready-for-obturation",
  "canal-obturation-complete",
  "mvp-complete",
]);

function inferCurrentNodeIdFromEvents(caseData) {
  const events = caseData?.globalEvents || [];
  const lastEvent = events[events.length - 1];
  if (!lastEvent?.type) return "preop";
  if (lastEvent.type === "workflow.switchedCanal" && lastEvent.details?.nextNode && protocolNodes[lastEvent.details.nextNode]) {
    return lastEvent.details.nextNode;
  }

  for (const node of Object.values(protocolNodes)) {
    const matchingOption = (node.options || []).find((option) => option.noteEvent?.type === lastEvent.type);
    if (matchingOption?.nextNodeId && protocolNodes[matchingOption.nextNodeId]) {
      return matchingOption.nextNodeId;
    }
  }

  return lastEvent.details?.nodeId && protocolNodes[lastEvent.details.nodeId] ? lastEvent.details.nodeId : "preop";
}

function getSavedCurrentNodeId(saved) {
  if (saved?.currentNodeId && protocolNodes[saved.currentNodeId]) return saved.currentNodeId;
  return inferCurrentNodeIdFromEvents(saved);
}

function getCanalCheckpointNodeId(caseData, canalName) {
  const canalEvents = (caseData?.globalEvents || []).filter((event) => {
    const isCaseWide = event.canal === "All" || event.canal === "N/A" || !event.canal;
    return event.canal === canalName || isCaseWide;
  });
  if (canalEvents.length) return inferCurrentNodeIdFromEvents({ ...caseData, globalEvents: canalEvents });

  const globalTypes = (caseData?.globalEvents || []).map((event) => event.type);
  if (globalTypes.includes("access.canalsIdentified") || globalTypes.includes("access.refined")) return "estimate-wl";
  if (globalTypes.includes("access.chamberConfirmed") || globalTypes.includes("access.chamberReached")) return "identify-canals";
  return "preop";
}

function makeDefaultNewCanalName(existingCanals = []) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const baseName = `New ${hh}:${mm}`;
  const existingNames = new Set(existingCanals.map((canal) => canal.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter += 1;
  return `${baseName} ${counter}`;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function isPositiveMeasurement(value) {
  if (isBlank(value)) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function formatLength(value) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function getSuggestedLengths(canal) {
  const eal0 = Number(canal?.eal0);
  if (!Number.isFinite(eal0) || eal0 <= 0) return { patency: "", shaping: "" };
  return {
    patency: formatLength(eal0 + 1),
    shaping: formatLength(Math.max(eal0 - 1, 0)),
  };
}

function isLikelyShape(value) {
  if (isBlank(value)) return false;
  const compact = String(value).trim().split(" ").join("");
  const parts = compact.split("/");
  if (parts.length !== 2) return false;
  const size = Number(parts[0]);
  const taper = parts[1];
  return Number.isFinite(size) && size > 0 && taper.startsWith(".") && Number.isFinite(Number(taper));
}

function isValidFinalShape(value) {
  return !isBlank(value);
}

function hasEvent(canal, type) {
  return (canal?.events || []).some((event) => event.type === type);
}

function isManualCanalStatusEvent(type) {
  return ["canal.completed", "canal.paused", "canal.medicated", "canal.referred"].includes(type);
}

function getCanalStatus(canal) {
  if (!canal) return "notStarted";
  if (hasEvent(canal, "canal.referred") || hasEvent(canal, "treatment.referralRecommended")) return "referred";
  if (hasEvent(canal, "closure.finalRestoration") || hasEvent(canal, "closure.orificeBarrierTemporary") || hasEvent(canal, "closure.temporary")) return "complete";
  if (hasEvent(canal, "backfill.completed") || hasEvent(canal, "backfill.compactedStable") || hasEvent(canal, "downpack.gpStableAfterCompaction")) return "complete";
  if (hasEvent(canal, "canal.completed")) return "complete";
  if (hasEvent(canal, "sealer.reapplied") || hasEvent(canal, "sealer.applied")) return "disinfected";
  if (hasEvent(canal, "coneFit.radiographAcceptable")) return "disinfected";
  if (hasEvent(canal, "disinfection.readyForObturation") || hasEvent(canal, "disinfection.finalNaOClCompleted")) return "disinfected";
  if (hasEvent(canal, "canal.paused")) return "paused";
  if (hasEvent(canal, "canal.medicated") || hasEvent(canal, "medication.calciumHydroxidePlaced")) return "medicated";
  if (hasEvent(canal, "shaping.completed") || !isBlank(canal.finalShape)) return "shaped";
  if (hasEvent(canal, "glidePath.created")) return "glidePath";
  if (hasEvent(canal, "workingLength.established") || !isBlank(canal.eal0)) return "wlEstablished";
  if (!isBlank(canal.estimatedWorkingLength) || hasEvent(canal, "scouting.estimatedWLSet")) return "scouted";
  return "notStarted";
}

export function getNextRecommendedNodeForCanal(canal) {
  const canalName = canal?.name || "Canal";
  const status = getCanalStatus(canal);

  const targets = {
    notStarted: {
      label: `Start ${canalName} at initial scouting`,
      nextNodeId: "estimate-wl",
      reason: `started ${canalName} at initial scouting`,
    },
    scouted: {
      label: `Continue ${canalName} at working length`,
      nextNodeId: "open-orifice",
      reason: `continued ${canalName} at working length`,
    },
    wlEstablished: {
      label: `Continue ${canalName} at glide path`,
      nextNodeId: "patency-10c",
      reason: `continued ${canalName} at glide path`,
    },
    glidePath: {
      label: `Continue ${canalName} at shaping`,
      nextNodeId: "gauge-final-shape",
      reason: `continued ${canalName} at shaping`,
    },
    shaped: {
      label: `Proceed with ${canalName} to obturation gauging`,
      nextNodeId: "ready-for-obturation",
      reason: `proceeded with ${canalName} to obturation gauging`,
    },
    disinfected: {
      label: `Proceed with ${canalName} to obturation gauging`,
      nextNodeId: "ready-for-obturation",
      reason: `proceeded with ${canalName} to obturation gauging`,
    },
    medicated: {
      label: `Resume ${canalName} from medication/next-visit pathway`,
      nextNodeId: "mvp-complete",
      reason: `resumed ${canalName} from medication/next-visit pathway`,
    },
    paused: {
      label: `Resume ${canalName} from paused pathway`,
      nextNodeId: "mvp-complete",
      reason: `resumed ${canalName} from paused pathway`,
    },
    complete: {
      label: `${canalName} complete; no continuation action`,
      nextNodeId: null,
      disabled: true,
      reason: "Complete",
    },
    referred: {
      label: `${canalName} referred; no continuation action`,
      nextNodeId: null,
      disabled: true,
      reason: "Referred",
    },
  };

  return {
    canalName,
    status,
    ...(targets[status] || targets.notStarted),
  };
}

function getCanalContinuationTargets(caseData, activeCanalName) {
  return (caseData?.canals || [])
    .filter((canal) => canal.name && canal.name !== activeCanalName)
    .map((canal) => {
      const target = getNextRecommendedNodeForCanal(canal);
      const hasCheckpointEvents = (caseData?.globalEvents || []).some(
        (event) => event.canal === canal.name && (event.type !== "workflow.switchedCanal" || event.details?.nextNode)
      );

      if (!target.disabled && hasCheckpointEvents) {
        const checkpointNodeId = getCanalCheckpointNodeId(caseData, canal.name);
        if (checkpointNodeId && checkpointNodeId !== "preop" && checkpointNodeId !== target.nextNodeId && protocolNodes[checkpointNodeId]) {
          const stepLabel = protocolNodes[checkpointNodeId].title.toLowerCase();
          return {
            ...target,
            label: `Continue ${target.canalName} at ${stepLabel}`,
            nextNodeId: checkpointNodeId,
            reason: `continued ${target.canalName} at ${stepLabel}`,
          };
        }
      }

      return target;
    });
}

function getProtocolOptionLabel(nodeId, option, activeCanal) {
  if (nodeId === "ready-for-obturation" && option.nextNodeId === "gauge-obturation-30") {
    return `Proceed to obturation gauging for ${activeCanal?.name || "active canal"}`;
  }
  return option.label;
}

function getDryingCompatibility(option, activeCanal) {
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

function getMissingRequirements(nodeId, option, caseData, activeCanal) {
  const missing = [];
  const label = option?.label || "";
  if (nodeId === "preop") {
    if (isBlank(caseData.tooth)) missing.push("Tooth");
    if (isBlank(caseData.procedureType)) missing.push("Procedure");
    if (!isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)) missing.push("Chamber depth in mm");
    if (!isPositiveMeasurement(activeCanal?.estimatedWorkingLength)) missing.push(`Estimated WL for ${activeCanal?.name || "active canal"}`);
  }
  if (nodeId === "access-chamber" && !isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)) missing.push("Chamber depth in mm");
  if (nodeId === "identify-canals" && (!caseData.canals?.length || caseData.canals.some((c) => isBlank(c.name)))) missing.push("At least one canal name");
  if (nodeId === "estimate-wl" && !isPositiveMeasurement(activeCanal?.estimatedWorkingLength)) missing.push(`Estimated WL for ${activeCanal?.name || "active canal"}`);
  if (nodeId === "advance-10c") {
    const estimatedWLRaw = activeCanal?.estimatedWorkingLength;
    const terminalLengthRaw = activeCanal?.fileTerminalLength;

    const estimatedWL = Number(estimatedWLRaw);
    const terminalLength = Number(terminalLengthRaw);

    if (!isPositiveMeasurement(estimatedWLRaw)) {
      missing.push(`Estimated WL for ${activeCanal?.name || "active canal"}`);
    }

    const selectedReachedEstimatedWL =
      label.includes("reached estimated WL") ||
      label.includes("reached estimated working length");

    const selectedStoppedShort =
      label.includes("stopped short");

    if (selectedStoppedShort && !isPositiveMeasurement(terminalLengthRaw)) {
      missing.push("10C terminal length");
    }

    if (
      selectedReachedEstimatedWL &&
      isPositiveMeasurement(estimatedWLRaw) &&
      isPositiveMeasurement(terminalLengthRaw) &&
      terminalLength < estimatedWL
    ) {
      missing.push("10C terminal length is shorter than estimated WL, so this option cannot be selected");
    }

    if (
      selectedStoppedShort &&
      isPositiveMeasurement(estimatedWLRaw) &&
      isPositiveMeasurement(terminalLengthRaw) &&
      terminalLength >= estimatedWL
    ) {
      missing.push("10C terminal length is not shorter than estimated WL, so this option cannot be selected");
    }
  }
  if (nodeId === "measure-available-space") {
    const atsRaw = activeCanal?.availableTreatmentSpace;
    const ats = Number(atsRaw);

    if (!isPositiveMeasurement(atsRaw)) {
      missing.push("Available treatment space in mm");
    }

    if (isBlank(activeCanal?.referencePoint)) {
      missing.push("Reference point");
    }

    if (Number.isFinite(ats) && ats > 0) {
      const selectedGreaterThan16 =
        label.includes(">16") || label.includes("> 16");

      const selectedLessOrEqual16 =
        label.includes("≤16") ||
        label.includes("≤ 16") ||
        label.includes("<=16") ||
        label.includes("<= 16") ||
        label.includes("<16") ||
        label.includes("< 16");

      if (selectedGreaterThan16 && ats <= 16) {
        missing.push("Available treatment space must be >16 mm for this option");
      }

      if (selectedLessOrEqual16 && ats > 16) {
        missing.push("Available treatment space must be ≤16 mm for this option");
      }
    }
}
  if (nodeId === "establish-eal0") {
    if (!isPositiveMeasurement(activeCanal?.eal0)) missing.push("EAL 0 in mm");
    if (!isPositiveMeasurement(activeCanal?.patencyLength)) missing.push("Patency length in mm");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
    if (isBlank(activeCanal?.referencePoint)) missing.push("Reference point");

    if (isBlank(activeCanal?.wlRadiographStatus)) {
      missing.push("WL PA status");
    }
  }
  if (nodeId === "patency-10c" && !isPositiveMeasurement(activeCanal?.patencyLength)) missing.push("Patency length in mm");
  if (nodeId === "guide-path" && !isPositiveMeasurement(activeCanal?.eal0)) missing.push("EAL 0 / guide path length in mm");
  if (nodeId === "gauge-final-shape" && !isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
  if (nodeId === "increase-shaping-gauge") {
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
    if (label.includes("binds") && !isValidFinalShape(activeCanal?.finalShape)) missing.push("Final shape/size");
  }
  if (nodeId === "create-final-shape" && label.includes("reached") && !isValidFinalShape(activeCanal?.finalShape)) missing.push("Final shape/size");
  if (nodeId === "remove-smear-layer") {
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
    if (!isValidFinalShape(activeCanal?.finalShape)) missing.push("Final shape/size");
  }
  if (nodeId === "agitate-edta" && !isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
  if (["gauge-obturation-30", "gauge-obturation-25"].includes(nodeId) && !isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
  if (["gauge-obturation-larger", "record-obturation-gauge"].includes(nodeId) && isBlank(activeCanal?.obturationGauge)) missing.push("Obturation gauge size, e.g. 30");
  if (nodeId === "fit-master-cone") {
    if (isBlank(activeCanal?.masterCone)) missing.push("Master cone, e.g. 30/.04");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
  }
  if (nodeId === "cone-long") {
    if (isBlank(activeCanal?.masterCone)) missing.push("Master cone");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
    if (isBlank(activeCanal?.referencePoint)) missing.push("Reference point");
  }
  if (nodeId === "cone-fit-radiograph" && isBlank(activeCanal?.coneFitRadiograph)) missing.push("Cone fit radiograph status");
  if (nodeId === "dry-for-obturation") {
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
    const dryingCompatibility = getDryingCompatibility(option, activeCanal);
    if (dryingCompatibility.applies && !dryingCompatibility.compatible) missing.push(dryingCompatibility.reason);
  }
  if (nodeId === "patency-before-sealer" && !isPositiveMeasurement(activeCanal?.patencyLength)) missing.push("Patency length in mm");
  if (nodeId === "paper-point-through-sealer" && !isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
  if (nodeId === "seat-gp-cone") {
    if (isBlank(activeCanal?.masterCone)) missing.push("Master cone");
    if (!isPositiveMeasurement(activeCanal?.shapingLength)) missing.push("Shaping length in mm");
  }
  return missing;
}

function getEventCanalScope(type, nodeId, canal) {
  const node = protocolNodes[nodeId];
  const phase = node?.phase || "";
  const caseLevelPrefixes = ["preop.", "access.", "closure."];
  const caseLevelTypes = [
    "workflow.allCanalsReadyForClosure",
    "workflow.returnedToStart",
  ];

  if (caseLevelPrefixes.some((prefix) => type.startsWith(prefix))) return "All";
  if (["Pre-op", "Access", "Closure", "Export"].includes(phase)) return "All";
  if (caseLevelTypes.includes(type)) return "All";
  return canal || "N/A";
}

function makeEvent({ type, tooth, canal, nodeId, label, activeCanal }) {
  const scopedCanal = getEventCanalScope(type, nodeId, canal);
  return {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    type,
    tooth,
    canal: scopedCanal,
    details: { nodeId, decisionLabel: label, canalSnapshot: activeCanal ? { ...activeCanal, events: undefined } : undefined },
  };
}

function compactList(values) {
  return values.filter(Boolean).join(", ");
}

function formatCanalMeasurements(c) {
  const bits = [];
  if (c.estimatedWorkingLength) bits.push(`est WL ${c.estimatedWorkingLength} mm`);
  if (c.fileTerminalLength) bits.push(`10C terminal ${c.fileTerminalLength} mm`);
  if (c.availableTreatmentSpace) bits.push(`ATS ${c.availableTreatmentSpace} mm`);
  if (c.eal0) bits.push(`EAL0 ${c.eal0} mm`);
  if (c.patencyLength) bits.push(`patency ${c.patencyLength} mm`);
  if (c.shapingLength) bits.push(`shape ${c.shapingLength} mm`);
  if (c.finalShape) bits.push(`final ${c.finalShape}`);
  if (c.obturationGauge) bits.push(`gauge ${c.obturationGauge}`);
  if (c.masterCone) bits.push(`MC ${c.masterCone}`);
  return bits.length ? `${c.name}: ${bits.join("; ")}` : null;
}

function eventFragment(event) {
  const canal = event.canal ? `${event.canal}: ` : "";
  const snap = event.details?.canalSnapshot || {};
  const fragments = {
    "preop.reviewCompleted": "Pre-op review completed; chamber depth and estimated WL recorded where available.",
    "access.chamberReached": "Pulp chamber reached during access.",
    "access.markedDepthNoChamber": "Marked access depth reached without chamber entry; stopped for radiographic/clinical reassessment.",
    "access.radiographRedirected": "Radiograph taken and access direction reassessed/redirected.",
    "access.chamberConfirmed": "Chamber access confirmed with endodontic explorer.",
    "access.chamberNotConfirmed": "Chamber access could not be confirmed; reassessment pathway selected.",
    "access.refined": "Access outline refined.",
    "access.canalsIdentified": "Canals identified and recorded.",
    "scouting.estimatedWLSet": `${canal}10C stopper set to estimated WL ${snap.estimatedWorkingLength || "___"} mm.`,
    "scouting.estimatedWLReached": `${canal}10C reached estimated WL.`,
    "scouting.fileStoppedShort": `${canal}10C stopped short at ${snap.fileTerminalLength || "___"} mm.`,
    "scouting.availableSpaceGreaterThan16": `${canal}Available treatment space ${snap.availableTreatmentSpace || "___"} mm; proceeded with caution.`,
    "scouting.availableSpaceLimited": `${canal}Available treatment space limited to ${snap.availableTreatmentSpace || "___"} mm; increased difficulty noted.`,
    "difficulty.proceededWithExtremeCaution": "Treatment continued with extreme caution due to increased difficulty.",
    "difficulty.exceedsComfort": "Difficulty exceeded clinician comfort; stop/referral pathway selected.",
    "orifice.opened": `${canal}Canal orifice opened and irrigated.`,
    "canal.driedForEAL": `${canal}Canal dried before EAL measurement.`,
    "workingLength.ealPatencySignal": `${canal}EAL signaled patency.`,
    "workingLength.ealReadsShort": `${canal}EAL read short at terminal length; troubleshooting selected.`,
    "workingLength.established": `${canal}WL established: EAL0 ${snap.eal0 || "___"} mm, patency ${snap.patencyLength || "___"} mm, shaping ${snap.shapingLength || "___"} mm, reference ${snap.referencePoint || "___"}, WL PA ${snap.wlRadiographStatus || "___"}.`,    "troubleshooting.fileResistance": `${canal}File resistance noted.`,
    "troubleshooting.fileStop": `${canal}File stop noted.`,
    "troubleshooting.prebendFileAdvanced": `${canal}Pre-bent 10C file advanced.`,
    "troubleshooting.prebendFailed": `${canal}Pre-bent 10C file did not advance; difficulty increased.`,
    "troubleshooting.middleThirdOpened": `${canal}Middle third opened with guide path file and irrigated.`,
    "troubleshooting.middleThirdNotSafe": `${canal}Could not safely advance in middle third; referral/stop pathway selected.`,
    "glidePath.patencyAchieved": `${canal}10C achieved patency length and became super loose.`,
    "glidePath.patencyShort": `${canal}10C stopped short of patency length.`,
    "glidePath.created": `${canal}Guide path created to EAL0 / guide path length.`,
    "glidePath.fileShort": `${canal}Guide path file did not reach EAL0.`,
    "shaping.gaugeNoResistance": `${canal}25 NiTi reached shaping length with no resistance; sequential gauge increase selected.`,
    "shaping.gaugeResistanceNearLength": `${canal}NiTi reached within 0 to 2 mm with resistance; proceeded to final .04 shaping.`,
    "shaping.gaugeMoreThan2mmShort": `${canal}NiTi remained more than 2 mm short of shaping length.`,
    "shaping.nextGaugeReachedLength": `${canal}Next larger NiTi hand file reached shaping length; continued sequential gauging.`,
    "shaping.finalGaugeSelected": `${canal}Final shaping gauge selected as ${snap.finalShape || "___"}; next larger NiTi bound / did not reach shaping length.`,
    "shaping.gaugeIncreaseUnsafe": `${canal}Gauge increase not safe/predictable; returned to patency/glide path work.`, 
    "shaping.finalShapeAchieved": `${canal}Final .04 shape achieved to ${snap.finalShape || "___"}.`,
    "shaping.finalShapeShort": `${canal}.04 shaping file did not reach shaping length.`,
    "shaping.completed": `${canal}Canal shaped, irrigated, and recapitulated.`,
    "smearLayer.edtaPlaced": `${canal}17% EDTA placed for 90 to 120 seconds for smear layer removal.`,
    "smearLayer.edtaAgitated": `${canal}EDTA agitated with measured GP cone without exceeding shaping length.`,
    "disinfection.finalNaOClCompleted": `${canal}Final NaOCl disinfection completed.`,
    "disinfection.readyForObturation": `${canal}Canal ready for obturation gauging.`,
    "obturationGauge.recorded": `${canal}Obturation gauge recorded as ${snap.obturationGauge || "___"}.`,
    "coneFit.radiographAcceptable": `${canal}Cone fit radiograph acceptable.`,
    "drying.readyForSealer": `${canal}Canal dried to dry/slightly damp paper point at shaping length; ready for sealer.`,
    "sealer.applied": `${canal}Bioceramic sealer applied with passive White NaviTip withdrawal.`,
    "sealer.reapplied": `${canal}Bioceramic sealer re-applied.`,
    "gpSeating.coneSeated": `${canal}Pre-fit GP cone seated to shaping length.`,
    "downpack.gpSeared": `${canal}GP cone(s) seared at the orifice.`,
    "backfill.completed": `${canal}Thermoplastic GP backfill completed.`,
    "closure.temporary": "Access closed with sponge and temporary restorative material.",
    "closure.orificeBarrierTemporary": "Orifice barrier and temporary restoration placed.",
    "closure.finalRestoration": "Final restoration placed.",
    "medication.calciumHydroxidePlaced": `${canal}Calcium hydroxide placed.`,
    "canal.completed": `${canal}Marked complete by clinician.`,
    "canal.paused": `${canal}Paused for later continuation.`,
    "canal.medicated": `${canal}Marked medicated/staged for continuation.`,
    "canal.referred": `${canal}Marked for referral or specialist continuation.`,
    "workflow.startedNextCanal": "Workflow moved to next canal.",
    "workflow.nextCanalSelected": "Workflow continued to another canal.",
    "workflow.nextCanalBeforeClosure": "Workflow continued to another canal before final chamber cleanup/closure.",
    "workflow.switchedCanal": `Workflow switched from ${event.details?.previousActiveCanal || "previous canal"} to ${event.details?.newActiveCanal || event.canal || "selected canal"}; ${event.details?.reason || "continued selected canal"}.`,
    "workflow.allCanalsReadyForClosure": "All canals ready for chamber cleanup and closure.",
    "workflow.returnedToStart": "Workflow returned to start.",
  };
  return fragments[event.type] || `${canal}${event.type}.`;
}

function deriveSuggestedCaseStatus(caseData) {
  const events = caseData.globalEvents.map((event) => event.type);
  if (events.includes("treatment.referralRecommended") || events.includes("treatment.referralSelected") || events.includes("canal.referred")) return "Referred";
  if (events.includes("medication.calciumHydroxidePlaced") || events.includes("canal.medicated")) return "Medicated and temporized";
  if (events.includes("closure.finalRestoration") || events.includes("closure.orificeBarrierTemporary") || events.includes("closure.temporary")) return "RCT completed";
  if (events.includes("canal.paused")) return "Resume next visit";
  return caseData.globalEvents.length ? "RCT initiated" : "RCT planned";
}

function getCaseStatus(caseData) {
  return caseData.caseStatus || deriveSuggestedCaseStatus(caseData);
}

function hydrateCaseStatusOverride(caseData) {
  if (!caseData?.caseStatus || caseData.caseStatus === "RCT planned") return "";
  return caseData.caseStatus;
}

const phaseProgressRules = {
  "Pre-op": ["preop."],
  Access: ["access."],
  "Initial scouting": ["scouting."],
  "Working length": ["workingLength."],
  "Glide path": ["glidePath."],
  Shaping: ["shaping."],
  "Smear / disinfection": ["smearLayer.", "disinfection."],
  "Obturation gauging": ["obturationGauge."],
  "Cone fit": ["coneFit."],
  "Sealer / cone seating": ["drying.readyForSealer", "sealer.", "gpSeating."],
  "Downpack / backfill": ["downpack.", "backfill."],
  Closure: ["closure."],
  Troubleshooting: ["troubleshooting.", "difficulty."],
  "Medication / temporisation": ["medication.", "treatment."],
  Export: ["workflow."],
};

function eventMatchesRule(eventType, rule) {
  return rule.endsWith(".") ? eventType.startsWith(rule) : eventType === rule || eventType.startsWith(rule);
}

function canalPhaseHasProgress(caseData, canalName, phase) {
  const rules = phaseProgressRules[phase] || [];
  return (caseData.globalEvents || []).some((event) => {
    const isCaseWide = event.canal === "All" || event.canal === "N/A" || !event.canal;
    const isCanalMatch = event.canal === canalName || isCaseWide;
    return isCanalMatch && rules.some((rule) => eventMatchesRule(event.type, rule));
  });
}

function getCanalPhaseIndicator(caseData, canalName, phase, currentPhase, activeCanalName) {
  const isCurrent = phase === currentPhase && canalName === activeCanalName;
  const hasProgress = canalPhaseHasProgress(caseData, canalName, phase);
  if (isCurrent) return { symbol: "●", label: "Current", className: "bg-slate-900 text-white border-slate-900" };
  if (hasProgress) return { symbol: "✓", label: "Recorded", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  return { symbol: "·", label: "Not recorded", className: "bg-slate-50 text-slate-400 border-slate-200" };
}

function getGlobalPhaseIndicator(caseData, phase, currentPhase) {
  const isCurrent = phase === currentPhase;
  const hasAnyProgress = (caseData.canals || []).some((canal) => canalPhaseHasProgress(caseData, canal.name, phase));
  if (isCurrent) return { className: "bg-slate-900 text-white", textClassName: "font-bold text-slate-950" };
  if (hasAnyProgress) return { className: "bg-emerald-100 text-emerald-800", textClassName: "font-semibold text-slate-700" };
  return { className: "bg-slate-100 text-slate-500", textClassName: "text-slate-500" };
}

function buildCompactNote(caseData) {
  const canals = caseData.canals || [];
  const located = canals.map((c) => c.name).filter(Boolean);
  const measurements = canals.map(formatCanalMeasurements).filter(Boolean);
  const events = caseData.globalEvents.map((event) => event.type);
  const note = [];
  note.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}.`);
  if (caseData.patientNumber) note.push(`Patient #: ${caseData.patientNumber}.`);
  note.push(`Visit status: ${getCaseStatus(caseData)}.`);
  note.push("RD isolation planned/used as clinically appropriate.");
  if (caseData.preOp?.estimatedChamberDepth) note.push(`Estimated chamber depth ${caseData.preOp.estimatedChamberDepth} mm.`);
  if (events.some((type) => type.startsWith("access."))) note.push("Access completed/refined and chamber/canal negotiation documented.");
  if (located.length) note.push(`Canals: ${located.join("/")}.`);
  if (measurements.length) note.push(`WL/shape data: ${measurements.join(" | ")}.`);
  if (events.includes("smearLayer.edtaPlaced") || events.includes("smearLayer.edtaAgitated")) note.push("17% EDTA smear layer removal performed.");
  if (events.includes("disinfection.finalNaOClCompleted") || events.includes("disinfection.readyForObturation")) note.push("Final NaOCl disinfection completed.");
  if (events.includes("coneFit.radiographAcceptable")) note.push("Master cone fit confirmed radiographically.");
  if (events.includes("sealer.applied") || events.includes("sealer.reapplied")) note.push("Bioceramic sealer placed.");
  if (events.includes("gpSeating.coneSeated")) note.push("Pre-fit GP cone seated to shaping length.");
  if (events.includes("backfill.completed") || events.includes("backfill.compactedStable")) note.push("Thermoplastic GP backfill completed and compacted.");
  if (events.includes("medication.calciumHydroxidePlaced")) note.push("Calcium hydroxide placed.");
  if (events.includes("closure.temporary")) note.push("Access closed with sponge and temporary restorative material.");
  if (events.includes("closure.orificeBarrierTemporary")) note.push("Orifice barrier and temporary restoration placed.");
  if (events.includes("closure.finalRestoration")) note.push("Final restoration placed.");
  if (caseData.nextVisitPlan) note.push(`Next visit/plan: ${caseData.nextVisitPlan}.`);
  if (caseData.difficulty !== "none") note.push(`Difficulty flag: ${caseData.difficulty}.`);
  note.push("POIG.");
  return note.join(" ");
}

function groupEventsByPrefix(caseData, prefixes) {
  return caseData.globalEvents.filter((event) => prefixes.some((prefix) => event.type.startsWith(prefix))).map(eventFragment);
}

function appendSection(lines, title, items) {
  lines.push(title);
  if (!items.length) lines.push("- Not recorded.");
  else items.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
}

function buildFullNote(caseData) {
  const lines = [];
  lines.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}`);
  if (caseData.patientNumber) lines.push(`Patient #: ${caseData.patientNumber}`);
  lines.push(`Visit status: ${getCaseStatus(caseData)}`);
  if (caseData.autosavedAt) lines.push(`Autosaved: ${new Date(caseData.autosavedAt).toLocaleString()}`);
  lines.push("");
  appendSection(lines, "Diagnosis / visit context:", [caseData.diagnosis?.pulpal ? `Pulpal diagnosis: ${caseData.diagnosis.pulpal}` : null, caseData.diagnosis?.apical ? `Apical diagnosis: ${caseData.diagnosis.apical}` : null, caseData.nextVisitPlan ? `Next visit / plan: ${caseData.nextVisitPlan}` : null].filter(Boolean));
  appendSection(lines, "Pre-op:", [`Radiographs reviewed: ${caseData.preOp?.radiographsReviewed ? "yes" : "not recorded"}`, `CBCT reviewed: ${caseData.preOp?.cbctReviewed ? "yes" : "no/not recorded"}`, caseData.preOp?.estimatedChamberDepth ? `Estimated chamber depth: ${caseData.preOp.estimatedChamberDepth} mm` : null].filter(Boolean));
  appendSection(lines, "Access / canals:", groupEventsByPrefix(caseData, ["access."]));
  const canalLines = [];
  caseData.canals.forEach((c) => {
    canalLines.push(`${c.name} (${statusLabels[getCanalStatus(c)]})`);
    if (c.estimatedWorkingLength) canalLines.push(`  ${c.name} estimated WL: ${c.estimatedWorkingLength} mm`);
    if (c.availableTreatmentSpace) canalLines.push(`  ${c.name} available treatment space: ${c.availableTreatmentSpace} mm`);
    if (c.referencePoint) canalLines.push(`  ${c.name} reference point: ${c.referencePoint}`);
    if (c.eal0) canalLines.push(`  ${c.name} EAL 0: ${c.eal0} mm`);
    if (c.patencyLength) canalLines.push(`  ${c.name} patency length: ${c.patencyLength} mm`);
    if (c.shapingLength) canalLines.push(`  ${c.name} shaping length: ${c.shapingLength} mm`);
    if (c.finalShape) canalLines.push(`  ${c.name} final shape: ${c.finalShape}`);
    if (c.obturationGauge) canalLines.push(`  ${c.name} obturation gauge: ${c.obturationGauge}`);
    if (c.masterCone) canalLines.push(`  ${c.name} master cone: ${c.masterCone}`);
  });
  appendSection(lines, "Canal measurements / status:", canalLines);
  appendSection(lines, "Working length / glide path / shaping:", groupEventsByPrefix(caseData, ["scouting.", "workingLength.", "glidePath.", "shaping."]));
  appendSection(lines, "Irrigation / smear layer / disinfection:", groupEventsByPrefix(caseData, ["smearLayer.", "disinfection."]));
  appendSection(lines, "Cone fit / obturation:", groupEventsByPrefix(caseData, ["obturationGauge.", "coneFit.", "drying.", "sealer.", "gpSeating.", "downpack.", "backfill."]));
  appendSection(lines, "Closure:", groupEventsByPrefix(caseData, ["closure.", "medication."]));
  appendSection(lines, "Difficulty / referral / canal controls:", groupEventsByPrefix(caseData, ["difficulty.", "treatment.", "canal.", "workflow."]));
  lines.push("Compact note:");
  lines.push(buildCompactNote(caseData));
  return lines.join(String.fromCharCode(10));
}

function buildPatientSummary(caseData) {
  const tooth = caseData.tooth || "the tooth";
  if (caseData.globalEvents.some((event) => event.type === "medication.calciumHydroxidePlaced")) return `Root canal treatment was started on tooth ${tooth}. The canals were cleaned as appropriate today, medication was placed, and a temporary filling was placed. Further treatment or referral may be needed.`;
  if (caseData.globalEvents.some((event) => event.type === "shaping.completed")) return `Root canal treatment steps were performed on tooth ${tooth}. The canals were located, measured, cleaned, shaped, and disinfected according to the recorded workflow.`;
  return `Endodontic treatment workflow was started for tooth ${tooth}. The clinician recorded procedural information to guide care and documentation.`;
}

function buildPrintableSummary(caseData) {
  const lines = [];
  lines.push("ENDODONTIC CHAIRSIDE SUMMARY");
  lines.push("============================");
  lines.push(`Patient #: ${caseData.patientNumber || "________________"}`);
  lines.push(`Tooth: ${caseData.tooth || "____"}`);
  lines.push(`Procedure: ${caseData.procedureType || "RCT"}`);
  lines.push(`Visit status: ${getCaseStatus(caseData)}`);
  lines.push(`Date/autosave: ${caseData.autosavedAt ? new Date(caseData.autosavedAt).toLocaleString() : new Date().toLocaleString()}`);
  lines.push("");
  lines.push("CANALS");
  caseData.canals.forEach((canal) => {
    lines.push(`- ${canal.name} (${statusLabels[getCanalStatus(canal)]})`);
    lines.push(`  Est WL: ${canal.estimatedWorkingLength || "___"} mm | EAL0: ${canal.eal0 || "___"} mm | Patency: ${canal.patencyLength || "___"} mm | Shaping: ${canal.shapingLength || "___"} mm`);
    lines.push(`  Ref: ${canal.referencePoint || "___"} | Final shape: ${canal.finalShape || "___"} | Gauge: ${canal.obturationGauge || "___"} | MC: ${canal.masterCone || "___"}`);
  });
  lines.push("");
  lines.push("COMPACT NOTE");
  lines.push(buildCompactNote(caseData));
  return lines.join(String.fromCharCode(10));
}

function buildEventLogExport(caseData) {
  const lines = [];
  lines.push("ENDODONTIC EVENT LOG");
  lines.push("====================");
  lines.push(`Patient #: ${caseData.patientNumber || ""}`);
  lines.push(`Tooth: ${caseData.tooth || ""}`);
  lines.push(`Procedure: ${caseData.procedureType || "RCT"}`);
  lines.push(`Visit status: ${getCaseStatus(caseData)}`);
  lines.push("");

  if (!caseData.globalEvents.length) {
    lines.push("No events recorded.");
    return lines.join(String.fromCharCode(10));
  }

  caseData.globalEvents.forEach((event, index) => {
    const time = event.timestamp ? new Date(event.timestamp).toLocaleString() : "no timestamp";
    lines.push(`${index + 1}. ${time}`);
    lines.push(`   Type: ${event.type}`);
    lines.push(`   Canal: ${event.canal || "case-level"}`);
    lines.push(`   Node: ${event.details?.nodeId || "not recorded"}`);
    lines.push(`   Decision: ${event.details?.decisionLabel || "not recorded"}`);
    lines.push(`   Note: ${eventFragment(event)}`);
    lines.push("");
  });

  return lines.join(String.fromCharCode(10));
}

function buildJsonExport(caseData, currentNodeId = null) {
  return {
    currentNodeId: currentNodeId || caseData.currentNodeId || inferCurrentNodeIdFromEvents(caseData),
    patientNumber: caseData.patientNumber,
    autosavedAt: caseData.autosavedAt,
    tooth: caseData.tooth,
    procedureType: caseData.procedureType,
    caseStatus: getCaseStatus(caseData),
    nextVisitPlan: caseData.nextVisitPlan,
    diagnosis: caseData.diagnosis,
    difficulty: caseData.difficulty,
    preOp: caseData.preOp,
    canals: caseData.canals.map((canal) => ({ ...canal, events: canal.events || [], status: statusLabels[getCanalStatus(canal)] })),
    closure: caseData.closure,
    events: caseData.globalEvents,
  };
}

function shouldHydrateCaseWideEventForCanal(event) {
  const isCaseWide = event?.canal === "All" || event?.canal === "N/A" || !event?.canal;
  return isCaseWide && event?.type?.startsWith("closure.") && event?.details?.nodeId === "close-access";
}

function hydrateCanalEventsFromGlobalEvents(canal, globalEvents = []) {
  const explicitEvents = Array.isArray(canal?.events) ? canal.events : [];
  const eventIds = new Set(explicitEvents.map((event) => event.id).filter(Boolean));
  const restoredEvents = globalEvents.filter((event) => {
    const appliesToCanal = event?.canal === canal?.name || shouldHydrateCaseWideEventForCanal(event);
    if (!appliesToCanal) return false;
    if (event.id && eventIds.has(event.id)) return false;
    return true;
  });

  return [...explicitEvents, ...restoredEvents];
}

const blankCanal = (name) => ({ name, estimatedWorkingLength: "", fileTerminalLength: "", availableTreatmentSpace: "", referencePoint: "", eal0: "", patencyLength: "", shapingLength: "", wlRadiographStatus: "", finalShape: "", obturationGauge: "", masterCone: "", coneFitRadiograph: "", dryingStatus: "", events: [] });

const initialCase = {
  patientNumber: "",
  autosavedAt: "",
  tooth: "",
  procedureType: "RCT",
  caseStatus: "",
  nextVisitPlan: "",
  diagnosis: { pulpal: "", apical: "" },
  difficulty: "none",
  preOp: { radiographsReviewed: true, cbctReviewed: false, estimatedChamberDepth: "" },
  currentCanal: "Main",
  canals: [blankCanal("Main")],
  globalEvents: [],
  closure: null,
};

function TextInput({ label, value, onChange, placeholder, invalid = false }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"}`}
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SectionCard({ title, children, className = "" }) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}><h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>{children}</section>;
}

export default function EndoChairsideGuideMVP() {
  const [caseData, setCaseData] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialCase, ...JSON.parse(saved) } : initialCase;
    } catch {
      return initialCase;
    }
  });
  const [currentNodeId, setCurrentNodeId] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? getSavedCurrentNodeId(JSON.parse(saved)) : "preop";
    } catch {
      return "preop";
    }
  });
  const [history, setHistory] = useState([]);
  const [newCanalName, setNewCanalName] = useState("");
  const [renameCanalName, setRenameCanalName] = useState("");
  const [noteMode, setNoteMode] = useState("compact");
  const [copied, setCopied] = useState(false);
  const [validationMessage, setValidationMessage] = useState(null);
  const [selectedProgressPhase, setSelectedProgressPhase] = useState("Pre-op");
  const [isProgressDetailOpen, setIsProgressDetailOpen] = useState(false);
  const [isCasePanelOpen, setIsCasePanelOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportBox, setShowImportBox] = useState(false);
  const [savedCases, setSavedCases] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CASE_INDEX_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const currentNode = protocolNodes[currentNodeId] || protocolNodes.preop;
  const activeCanal = useMemo(() => caseData.canals.find((c) => c.name === caseData.currentCanal) || caseData.canals[0], [caseData.canals, caseData.currentCanal]);
  const activePhaseIndex = phases.indexOf(currentNode.phase);
  const activeCanalStatus = getCanalStatus(activeCanal);
  const suggestedLengths = getSuggestedLengths(activeCanal);
  const progressPhase = selectedProgressPhase || currentNode.phase;
  const isHandoffNode = handoffNodeIds.has(currentNode.id);
  const continuationTargets = useMemo(
    () => getCanalContinuationTargets(caseData, activeCanal?.name),
    [caseData, activeCanal?.name]
  );

  useEffect(() => setRenameCanalName(activeCanal?.name || ""), [activeCanal?.name]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const autosavedAt = new Date().toISOString();
      const snapshot = { ...caseData, autosavedAt, currentNodeId };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      const caseId = makeCaseId(snapshot);
      window.localStorage.setItem(`${CASE_RECORD_PREFIX}${caseId}`, JSON.stringify(snapshot));
      const summary = { id: caseId, patientNumber: snapshot.patientNumber || "No patient #", tooth: snapshot.tooth || "Tooth ___", procedureType: snapshot.procedureType || "RCT", currentNodeId, canalCount: snapshot.canals?.length || 0, eventCount: snapshot.globalEvents?.length || 0, autosavedAt };
      setSavedCases((prev) => {
        const next = [summary, ...prev.filter((item) => item.id !== caseId)].slice(0, 12);
        window.localStorage.setItem(CASE_INDEX_KEY, JSON.stringify(next));
        return next;
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [caseData, currentNodeId]);

  function updateCase(updates) { setCaseData((prev) => ({ ...prev, ...updates })); setValidationMessage(null); }
  function updatePreOp(field, value) { setCaseData((prev) => ({ ...prev, preOp: { ...prev.preOp, [field]: value } })); setValidationMessage(null); }
  function updateDiagnosis(field, value) { setCaseData((prev) => ({ ...prev, diagnosis: { ...(prev.diagnosis || {}), [field]: value } })); setValidationMessage(null); }
  function applySuggestedCaseStatus() { updateCase({ caseStatus: "" }); }
  function updateActiveCanal(field, value) {
    setCaseData((prev) => ({
      ...prev,
      canals: prev.canals.map((c) => (c.name === prev.currentCanal ? { ...c, [field]: value } : c)),
    }));
    setValidationMessage(null);
  }

  function applyEalDerivedLengths() {
    const suggested = getSuggestedLengths(activeCanal);
    if (!suggested.patency || !suggested.shaping) {
      setValidationMessage({ optionLabel: "Use EAL ±1", missing: ["Enter a valid EAL 0 first"] });
      return;
    }
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    setCaseData((prev) => ({
      ...prev,
      canals: prev.canals.map((c) =>
        c.name === prev.currentCanal
          ? { ...c, patencyLength: suggested.patency, shapingLength: suggested.shaping }
          : c
      ),
    }));
    setValidationMessage(null);
  }

  function startNewCase() { const fresh = { ...initialCase, autosavedAt: new Date().toISOString(), tooth: "", currentCanal: "Main", canals: [blankCanal("Main")] }; setCaseData(fresh); setCurrentNodeId("preop"); setHistory([]); setValidationMessage(null); }
  function loadSavedCase(caseId) { try { const saved = JSON.parse(window.localStorage.getItem(`${CASE_RECORD_PREFIX}${caseId}`) || "null"); if (!saved) return; setCaseData({ ...initialCase, ...saved }); setCurrentNodeId(getSavedCurrentNodeId(saved)); setHistory([]); setValidationMessage(null); } catch { setValidationMessage({ optionLabel: "Load saved case", missing: ["Could not load saved case from local storage"] }); } }
  function deleteSavedCase(caseId) { window.localStorage.removeItem(`${CASE_RECORD_PREFIX}${caseId}`); setSavedCases((prev) => { const next = prev.filter((item) => item.id !== caseId); window.localStorage.setItem(CASE_INDEX_KEY, JSON.stringify(next)); return next; }); }
  function clearSavedCurrentCase() { const caseId = makeCaseId(caseData); window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(`${CASE_RECORD_PREFIX}${caseId}`); deleteSavedCase(caseId); startNewCase(); }
  function resetAllSavedCases() { Object.keys(window.localStorage).forEach((key) => { if (key.startsWith(CASE_RECORD_PREFIX) || key === STORAGE_KEY || key === CASE_INDEX_KEY) window.localStorage.removeItem(key); }); setSavedCases([]); startNewCase(); }

  function downloadCaseJson() { const blob = new Blob([JSON.stringify(buildJsonExport(caseData, currentNodeId), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `endo-case-${caseData.patientNumber || "no-patient"}-${caseData.tooth || "tooth"}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }
  function importCaseJson() { try { const parsed = JSON.parse(importText); const globalEvents = Array.isArray(parsed.events) ? parsed.events : Array.isArray(parsed.globalEvents) ? parsed.globalEvents : []; const importedCanals = Array.isArray(parsed.canals) && parsed.canals.length ? parsed.canals.map((canal) => { const normalizedCanal = { ...blankCanal(canal.name || "Canal"), ...canal }; return { ...normalizedCanal, events: hydrateCanalEventsFromGlobalEvents(normalizedCanal, globalEvents) }; }) : initialCase.canals; const imported = { ...initialCase, ...parsed, caseStatus: hydrateCaseStatusOverride(parsed), canals: importedCanals, globalEvents, autosavedAt: new Date().toISOString() }; setCaseData(imported); setCurrentNodeId(getSavedCurrentNodeId(imported)); setHistory([]); setShowImportBox(false); setImportText(""); setValidationMessage(null); } catch { setValidationMessage({ optionLabel: "Import JSON", missing: ["Invalid JSON or unsupported case format"] }); } }

  function selectCanal(canalName) {
    setCaseData((prev) => ({ ...prev, currentCanal: canalName }));
    setCurrentNodeId(getCanalCheckpointNodeId(caseData, canalName));
    setValidationMessage(null);
  }

  function addCanal() {
    const typedName = newCanalName.trim();
    const canalName = typedName ? typedName.toUpperCase() : makeDefaultNewCanalName(caseData.canals);
    if (caseData.canals.some((c) => c.name === canalName)) {
      selectCanal(canalName);
      return;
    }
    const nextCaseData = { ...caseData, currentCanal: canalName, canals: [...caseData.canals, blankCanal(canalName)] };
    setCaseData(nextCaseData);
    setCurrentNodeId(getCanalCheckpointNodeId(nextCaseData, canalName));
    setRenameCanalName(canalName);
    setNewCanalName("");
    setValidationMessage(null);
  }
  function renameActiveCanal() { const nextName = renameCanalName.trim().toUpperCase(); if (!activeCanal || !nextName) return; if (caseData.canals.some((c) => c.name === nextName && c.name !== activeCanal.name)) { setValidationMessage({ optionLabel: "Rename canal", missing: [`A canal named ${nextName} already exists`] }); return; } setHistory((prev) => [...prev, { caseData, currentNodeId }]); setCaseData((prev) => ({ ...prev, currentCanal: nextName, canals: prev.canals.map((c) => c.name === prev.currentCanal ? { ...c, name: nextName, events: (c.events || []).map((event) => ({ ...event, canal: nextName })) } : c), globalEvents: prev.globalEvents.map((event) => event.canal === prev.currentCanal ? { ...event, canal: nextName } : event) })); setValidationMessage(null); }
  function deleteActiveCanal() { if (!activeCanal) return; if (caseData.canals.length <= 1) { setValidationMessage({ optionLabel: "Delete canal", missing: ["At least one canal must remain. Rename this canal instead."] }); return; } setHistory((prev) => [...prev, { caseData, currentNodeId }]); setCaseData((prev) => { const remaining = prev.canals.filter((c) => c.name !== prev.currentCanal); return { ...prev, currentCanal: remaining[0]?.name || "", canals: remaining, globalEvents: prev.globalEvents.filter((event) => event.canal !== prev.currentCanal) }; }); setRenameCanalName(""); setValidationMessage(null); }

  function addManualCanalEvent(type, label, nextNodeId = null, difficultyFlag = null) { if (!activeCanal) return; setHistory((prev) => [...prev, { caseData, currentNodeId }]); const event = makeEvent({ type, tooth: caseData.tooth, canal: activeCanal.name, nodeId: currentNode.id, label, activeCanal }); setCaseData((prev) => ({ ...prev, difficulty: difficultyFlag || prev.difficulty, canals: prev.canals.map((c) => c.name === prev.currentCanal ? { ...c, events: [...(c.events || []), event] } : c), globalEvents: [...prev.globalEvents, event] })); if (nextNodeId) setCurrentNodeId(nextNodeId); setCopied(false); setValidationMessage(null); }

  function resetActiveCanalManualStatus() {
    if (!activeCanal) return;
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);

    const nextCaseData = {
      ...caseData,
      canals: caseData.canals.map((c) =>
        c.name === caseData.currentCanal
          ? { ...c, events: (c.events || []).filter((event) => !isManualCanalStatusEvent(event.type)) }
          : c
      ),
      globalEvents: caseData.globalEvents.filter(
        (event) => event.canal !== caseData.currentCanal || !isManualCanalStatusEvent(event.type)
      ),
    };

    setCaseData(nextCaseData);
    setCurrentNodeId(inferCurrentNodeIdFromEvents(nextCaseData));
    setValidationMessage(null);
  }
  function findNextIncompleteCanal(data = caseData) {
    const currentIndex = data.canals.findIndex((c) => c.name === data.currentCanal);
    return (
      data.canals.find((c, index) => index > currentIndex && getCanalStatus(c) !== "complete") ||
      data.canals.find((c) => c.name !== data.currentCanal && getCanalStatus(c) !== "complete") ||
      null
    );
  }

  function findNextUnstartedCanal(data = caseData) {
    const currentIndex = data.canals.findIndex((c) => c.name === data.currentCanal);
    return (
      data.canals.find((c, index) => index > currentIndex && getCanalStatus(c) === "notStarted") ||
      data.canals.find((c) => c.name !== data.currentCanal && getCanalStatus(c) === "notStarted") ||
      null
    );
  }

  function createNewCanalAtEstimate(data = caseData) {
    const name = makeDefaultNewCanalName(data.canals);
    const nextCaseData = { ...data, currentCanal: name, canals: [...data.canals, blankCanal(name)] };
    setCaseData(nextCaseData);
    setCurrentNodeId("estimate-wl");
    setRenameCanalName(name);
    setValidationMessage(null);
    return true;
  }

  function continueCanal(target) {
    if (!target || target.disabled || !target.nextNodeId) {
      setValidationMessage({ optionLabel: target?.label || "Continue canal", missing: [target?.reason || "No continuation action is available for this canal"] });
      return;
    }

    const targetCanal = caseData.canals.find((canal) => canal.name === target.canalName);
    if (!targetCanal) {
      setValidationMessage({ optionLabel: target.label, missing: [`Canal ${target.canalName} was not found`] });
      return;
    }

    setHistory((prev) => [...prev, { caseData, currentNodeId }]);

    const event = makeEvent({
      type: "workflow.switchedCanal",
      tooth: caseData.tooth,
      canal: target.canalName,
      nodeId: currentNode.id,
      label: target.label,
      activeCanal: targetCanal,
    });
    event.details = {
      ...event.details,
      previousActiveCanal: caseData.currentCanal,
      newActiveCanal: target.canalName,
      previousNode: currentNode.id,
      nextNode: target.nextNodeId,
      reason: target.reason || target.label,
    };

    setCaseData((prev) => ({
      ...prev,
      currentCanal: target.canalName,
      canals: prev.canals.map((canal) =>
        canal.name === target.canalName
          ? { ...canal, events: [...(canal.events || []), event] }
          : canal
      ),
      globalEvents: [...prev.globalEvents, event],
    }));
    setCurrentNodeId(target.nextNodeId);
    setCopied(false);
    setValidationMessage(null);
  }

  function startAnotherCanal(data = caseData) {
    const nextCanal = findNextUnstartedCanal(data);
    if (nextCanal) {
      setCaseData((prev) => ({ ...prev, currentCanal: nextCanal.name }));
      setCurrentNodeId(getCanalCheckpointNodeId(data, nextCanal.name));
      setValidationMessage(null);
      return true;
    }
    return createNewCanalAtEstimate(data);
  }

  function startNextCanal(data = caseData) {
    return startAnotherCanal(data);
  }

  function applyDecision(option) {
    const missing = getMissingRequirements(currentNode.id, option, caseData, activeCanal);
    if (missing.length) {
      setValidationMessage({ optionLabel: option.label, missing });
      return;
    }

    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const event = option.noteEvent ? makeEvent({ type: option.noteEvent.type, tooth: caseData.tooth, canal: activeCanal?.name, nodeId: currentNode.id, label: option.label, activeCanal }) : null;
    const appliesToAllCanals = event && currentNode.id === "close-access" && event.canal === "All";

    const nextCaseData = {
      ...caseData,
      difficulty: option.difficultyFlag || caseData.difficulty || "none",
      closure: option.noteEvent?.type?.startsWith("closure.") ? { type: option.noteEvent.type } : caseData.closure,
      canals: event ? caseData.canals.map((c) => appliesToAllCanals || c.name === caseData.currentCanal ? { ...c, events: [...(c.events || []), event] } : c) : caseData.canals,
      globalEvents: event ? [...caseData.globalEvents, event] : caseData.globalEvents,
    };

    if (option.noteEvent?.type === "workflow.nextCanalBeforeClosure") {
      const nextCanal = findNextIncompleteCanal(nextCaseData);
      if (!nextCanal) {
        setCaseData(nextCaseData);
        setCurrentNodeId("canal-obturation-complete");
        setValidationMessage({ optionLabel: option.label, missing: ["No other incomplete canal found. Use 'All canals obturated; proceed to chamber cleanup' if ready."] });
        return;
      }
      setCaseData({ ...nextCaseData, currentCanal: nextCanal.name });
      setCurrentNodeId(getCanalCheckpointNodeId(nextCaseData, nextCanal.name));
      setCopied(false);
      setValidationMessage(null);
      return;
    }

    if (option.noteEvent?.type === "workflow.nextCanalSelected") {
      startAnotherCanal(nextCaseData);
      setCopied(false);
      return;
    }

    setCaseData(nextCaseData);
    setCurrentNodeId(option.nextNodeId);
    setCopied(false);
    setValidationMessage(null);
  }
  function undo() { const previous = history[history.length - 1]; if (!previous) return; setCaseData(previous.caseData); setCurrentNodeId(previous.currentNodeId); setHistory((prev) => prev.slice(0, -1)); setValidationMessage(null); }

  const compactNote = buildCompactNote(caseData);
  const fullNote = buildFullNote(caseData);
  const patientSummary = buildPatientSummary(caseData);
  const jsonExport = JSON.stringify(buildJsonExport(caseData, currentNodeId), null, 2);
  const printableSummary = buildPrintableSummary(caseData);
  const eventLogExport = buildEventLogExport(caseData);
  const displayedNote = noteMode === "compact" ? compactNote : noteMode === "full" ? fullNote : noteMode === "patient" ? patientSummary : noteMode === "print" ? printableSummary : noteMode === "event log" ? eventLogExport : jsonExport;

  async function copyDisplayedNote() { try { await navigator.clipboard.writeText(displayedNote); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { setCopied(false); } }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-[96rem] space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Canvas MVP · layout pass</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Endodontic Chairside Decision Guide</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">State-machine chairside workflow with event-based notes and local case persistence.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">Patient: {caseData.patientNumber || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">Tooth: {caseData.tooth || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">{caseData.procedureType || "RCT"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">{getCaseStatus(caseData)}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">Autosaved: {caseData.autosavedAt ? new Date(caseData.autosavedAt).toLocaleTimeString() : "not yet"}</span>
              <button
                type="button"
                onClick={() => setIsCasePanelOpen(true)}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold leading-none text-white transition hover:bg-slate-800"
              >
                Case management
              </button>
            </div>
          </div>
        </header>

        <div className={`rounded-2xl border p-4 text-sm shadow-sm ${difficultyStyles[caseData.difficulty]}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <strong>{difficultyLabels[caseData.difficulty]}</strong>
              <span>Current phase: <strong>{currentNode.phase}</strong> · Active canal: <strong>{activeCanal?.name}</strong> · Status: <strong>{statusLabels[activeCanalStatus]}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProgressPhase(currentNode.phase);
                setIsProgressDetailOpen(true);
              }}
              className="shrink-0 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Phase / canal map
            </button>
          </div>
        </div>

        <main className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px] 2xl:grid-cols-[240px_minmax(360px,1fr)_320px_340px]">
          <aside className="contents 2xl:block 2xl:min-w-0 2xl:space-y-4">
            <SectionCard title="Canal selector" className="order-1 xl:col-start-1 xl:row-start-1 2xl:col-auto 2xl:row-auto 2xl:order-none">
              <div className="mb-3 grid gap-2">
                {caseData.canals.map((canal) => {
                  const status = getCanalStatus(canal);
                  return (
                    <button
                      key={canal.name}
                      onClick={() => selectCanal(canal.name)}
                      className={`rounded-xl border p-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${canal.name === caseData.currentCanal ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <strong>{canal.name}</strong>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${canal.name === caseData.currentCanal ? "border-white/30 bg-white/10 text-white" : statusStyles[status]}`}>{statusLabels[status]}</span>
                      </span>
                      <span className="mt-1 block text-xs opacity-75">{formatCanalMeasurements(canal) || "No measurements yet"}</span>
                    </button>
                  );
                })}
              </div>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Add / rename canals</summary>
                <div className="mt-3 grid gap-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add canal</p>
                    <div className="grid gap-2">
                      <input value={newCanalName} onChange={(e) => setNewCanalName(e.target.value)} className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" placeholder="blank = New" />
                      <button onClick={addCanal} className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add</button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Rename active canal</p>
                    <div className="grid gap-2">
                      <input value={renameCanalName} onChange={(e) => setRenameCanalName(e.target.value)} className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" placeholder="e.g., B, L, P" />
                      <button onClick={renameActiveCanal} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Rename</button>
                    </div>
                    <button onClick={deleteActiveCanal} className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">Delete active canal</button>
                  </div>
                </div>
              </details>
            </SectionCard>

            <SectionCard title="Canal controls" className="order-2 xl:col-start-2 xl:row-start-1 2xl:col-auto 2xl:row-auto 2xl:order-none">
              <div className="grid gap-2 text-sm">
                <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${statusStyles[activeCanalStatus]}`}>{activeCanal?.name || "Canal"}: {statusLabels[activeCanalStatus]}</div>
                <button onClick={() => addManualCanalEvent("canal.completed", "Mark active canal complete", "mvp-complete")} className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 font-semibold text-green-900 hover:bg-green-100">Mark active canal complete</button>
                <button onClick={() => addManualCanalEvent("canal.paused", "Pause active canal", "mvp-complete")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">Pause active canal</button>
                <button onClick={() => addManualCanalEvent("canal.medicated", "Mark active canal medicated", "temporary-closure", "high")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-100">Medicate active canal</button>
                <button onClick={() => addManualCanalEvent("canal.referred", "Refer active canal", "refer-pathway", "refer")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800 hover:bg-red-100">Refer active canal</button>
                <button onClick={startNextCanal} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-900 hover:bg-blue-100">Start next incomplete canal</button>
                <button onClick={resetActiveCanalManualStatus} className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Return to automatic status</button>
              </div>
            </SectionCard>
          </aside>

          <section className="contents 2xl:block 2xl:min-w-0 2xl:space-y-4">
            <section className="order-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-start-1 xl:row-start-2 2xl:col-auto 2xl:row-auto 2xl:order-none">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Decision card</h3>
                <button onClick={undo} disabled={!history.length} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Undo last decision</button>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase : {currentNode.phase}</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">{currentNode.title}</h2>
              </div>
              <p className="rounded-2xl bg-slate-50 p-4 text-base leading-7 text-slate-800">{currentNode.chairsideInstruction}</p>
              {(currentNode.instruments?.length || currentNode.materials?.length || currentNode.requiredInputs?.length) && <div className="mt-4 grid gap-3 md:grid-cols-3">{currentNode.instruments?.length ? <div className="rounded-2xl border border-slate-200 p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Instruments</h4><p className="mt-2 text-sm text-slate-700">{compactList(currentNode.instruments)}</p></div> : null}{currentNode.materials?.length ? <div className="rounded-2xl border border-slate-200 p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Materials</h4><p className="mt-2 text-sm text-slate-700">{compactList(currentNode.materials)}</p></div> : null}{currentNode.requiredInputs?.length ? <div className="rounded-2xl border border-slate-200 p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Record before continuing</h4><p className="mt-2 text-sm text-slate-700">{compactList(currentNode.requiredInputs)}</p></div> : null}</div>}
              {currentNode.safetyNotes?.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Safety / stop rule</strong><ul className="mt-2 list-inside list-disc space-y-1">{currentNode.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
              {validationMessage ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>Cannot continue with “{validationMessage.optionLabel}” yet.</strong><p className="mt-1">Please record/fix:</p><ul className="mt-2 list-inside list-disc space-y-1">{validationMessage.missing.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
              <div className="mt-5 grid gap-3">
                {currentNode.options.map((option) => {
                  const displayLabel = getProtocolOptionLabel(currentNode.id, option, activeCanal);
                  const displayOption = displayLabel === option.label ? option : { ...option, label: displayLabel };
                  const missing = getMissingRequirements(currentNode.id, displayOption, caseData, activeCanal);
                  return (
                    <button key={option.label} onClick={() => applyDecision(displayOption)} className={`rounded-2xl border bg-white p-4 text-left text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${missing.length ? "border-red-200 text-slate-800 hover:bg-red-50" : "border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"}`}>
                      {displayLabel}
                      <span className="mt-1 block text-xs font-normal text-slate-500">Next: {protocolNodes[option.nextNodeId]?.title || option.nextNodeId}</span>
                      {missing.length ? <span className="mt-2 block rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-800">Missing: {missing.join(", ")}</span> : null}
                    </button>
                  );
                })}
              </div>
              {isHandoffNode ? (
                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <h4 className="text-sm font-bold text-blue-950">Continue another canal</h4>
                  <div className="mt-3 grid gap-2">
                    {continuationTargets.length ? continuationTargets.map((target) => (
                      <button
                        key={target.canalName}
                        type="button"
                        disabled={target.disabled}
                        onClick={() => continueCanal(target)}
                        className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${target.disabled ? "cursor-not-allowed border-slate-200 bg-white/70 text-slate-400" : "border-blue-200 bg-white text-blue-950 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{target.label}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[target.status]}`}>{statusLabels[target.status]}</span>
                        </span>
                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          {target.nextNodeId ? `Next: ${protocolNodes[target.nextNodeId]?.title || target.nextNodeId}` : target.reason || "No continuation action"}
                        </span>
                      </button>
                    )) : (
                      <p className="rounded-xl border border-blue-100 bg-white/70 px-3 py-2 text-sm text-blue-900">No other canals are recorded yet.</p>
                    )}
                  </div>
                  <div className="mt-3 border-t border-blue-100 pt-3">
                    <button
                      type="button"
                      onClick={() => createNewCanalAtEstimate(caseData)}
                      className="w-full rounded-xl border border-dashed border-blue-300 bg-white px-3 py-3 text-sm font-bold text-blue-950 transition hover:bg-blue-100"
                    >
                      Add new canal
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </section>

          <aside className="order-4 min-w-0 space-y-4 xl:col-start-2 xl:row-start-2 2xl:col-auto 2xl:row-auto 2xl:order-none">
            <SectionCard title="Measurements">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Case-level measurement</p>
                  <TextInput
                    label="Chamber depth"
                    value={caseData.preOp.estimatedChamberDepth}
                    onChange={(v) => updatePreOp("estimatedChamberDepth", v)}
                    placeholder="mm"
                    invalid={["preop", "access-chamber"].includes(currentNodeId) && !isPositiveMeasurement(caseData.preOp.estimatedChamberDepth)}
                  />
                  <p className="mt-2 text-xs text-slate-500">Used for access planning and pre-op/access validation.</p>
                </div>
                <TextInput label="Estimated WL" value={activeCanal?.estimatedWorkingLength} onChange={(v) => updateActiveCanal("estimatedWorkingLength", v)} placeholder="mm" invalid={["preop", "estimate-wl", "advance-10c"].includes(currentNodeId) && !isPositiveMeasurement(activeCanal?.estimatedWorkingLength)} />
                <TextInput label="10C terminal length" value={activeCanal?.fileTerminalLength} onChange={(v) => updateActiveCanal("fileTerminalLength", v)} placeholder="if stopped short" />
                <TextInput label="Available treatment space" value={activeCanal?.availableTreatmentSpace} onChange={(v) => updateActiveCanal("availableTreatmentSpace", v)} placeholder="mm" invalid={currentNodeId === "measure-available-space" && !isPositiveMeasurement(activeCanal?.availableTreatmentSpace)} />
                <TextInput label="Reference point" value={activeCanal?.referencePoint} onChange={(v) => updateActiveCanal("referencePoint", v)} placeholder="e.g., MB cusp" invalid={["measure-available-space", "establish-eal0"].includes(currentNodeId) && isBlank(activeCanal?.referencePoint)} />
                <div className="grid grid-cols-2 gap-2">
                  <TextInput label="EAL 0" value={activeCanal?.eal0} onChange={(v) => updateActiveCanal("eal0", v)} placeholder="mm" />
                  <SelectInput label="WL PA" value={activeCanal?.wlRadiographStatus || ""} onChange={(v) => updateActiveCanal("wlRadiographStatus", v)} options={["", "acceptable", "short", "long", "not taken"]} />
                  <TextInput label="Patency" value={activeCanal?.patencyLength} onChange={(v) => updateActiveCanal("patencyLength", v)} placeholder="mm" />
                  <TextInput label="Shaping" value={activeCanal?.shapingLength} onChange={(v) => updateActiveCanal("shapingLength", v)} placeholder="mm" />
                </div>
                <div className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
                  {suggestedLengths.patency && suggestedLengths.shaping ? <span>Suggested from EAL 0: patency <strong>{suggestedLengths.patency}</strong> mm, shaping <strong>{suggestedLengths.shaping}</strong> mm.</span> : <span>Enter EAL 0 to preview suggested patency/shaping lengths.</span>}
                </div>
                <button onClick={applyEalDerivedLengths} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100">Use EAL ±1 {suggestedLengths.patency && suggestedLengths.shaping ? `(patency ${suggestedLengths.patency}, shaping ${suggestedLengths.shaping})` : ""}</button>
                <div className="grid grid-cols-2 gap-2">
                  <TextInput label="Final shape" value={activeCanal?.finalShape} onChange={(v) => updateActiveCanal("finalShape", v)} placeholder="30/.04" />
                  <TextInput label="Master cone" value={activeCanal?.masterCone} onChange={(v) => updateActiveCanal("masterCone", v)} placeholder="30/.04" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextInput label="Obturation gauge" value={activeCanal?.obturationGauge} onChange={(v) => updateActiveCanal("obturationGauge", v)} placeholder="30" />
                  <SelectInput label="Cone fit PA" value={activeCanal?.coneFitRadiograph || ""} onChange={(v) => updateActiveCanal("coneFitRadiograph", v)} options={["", "acceptable", "short", "long", "not taken"]} />
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Drying status</span>
                  <select value={activeCanal?.dryingStatus || ""} onChange={(event) => updateActiveCanal("dryingStatus", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="">Select drying status</option>
                    <option value="dry">dry</option>
                    <option value="slightly damp">slightly damp</option>
                    <option value="wet">wet</option>
                    <option value="persistent wet">persistent wet</option>
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">Current recorded status: {activeCanal?.dryingStatus || "not recorded"}</span>
                </label>
              </div>
            </SectionCard>
          </aside>

          <aside className="order-6 min-w-0 space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:block xl:space-y-4 2xl:col-auto 2xl:row-auto 2xl:order-none">
            <SectionCard title="Live note preview" className="lg:order-2 xl:order-none"><div className="mb-3 grid grid-cols-2 gap-2">{["compact", "full", "patient", "print", "event log", "json"].map((mode) => <button key={mode} onClick={() => setNoteMode(mode)} className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${noteMode === mode ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{mode}</button>)}</div><textarea readOnly value={displayedNote} className="h-[420px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-800 outline-none" />{noteMode === "print" ? <button onClick={() => window.print()} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Print browser page</button> : null}<button onClick={copyDisplayedNote} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{copied ? "Copied" : "Copy current output"}</button></SectionCard>

            <SectionCard title="Recent event log" className="lg:order-1 xl:order-none">
              {caseData.globalEvents.length ? (
                <div className="max-h-56 space-y-2 overflow-auto pr-1">
                  {[...caseData.globalEvents].reverse().slice(0, 8).map((event) => (
                    <div key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-slate-800">{event.type}</strong>
                        <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{eventFragment(event)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No events yet. Select a decision to start the note trail.</p>
              )}
            </SectionCard>
          </aside>
        </main>
        {isCasePanelOpen ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-950/30 p-4">
            <section className="mt-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Case management</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">Patient / visit / saved cases</h2>
                  <p className="mt-1 text-sm text-slate-600">Edit case identity, diagnosis, visit status, next-visit plan, and saved-case JSON actions.</p>
                </div>
                <button
                  onClick={() => setIsCasePanelOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Patient / visit</h3>
                  <div className="grid gap-3">
                    <TextInput label="Patient #" value={caseData.patientNumber} onChange={(v) => updateCase({ patientNumber: v })} placeholder="chart number" />
                    <TextInput label="Tooth" value={caseData.tooth} onChange={(v) => updateCase({ tooth: v })} invalid={isBlank(caseData.tooth)} />
                    <SelectInput label="Procedure" value={caseData.procedureType} onChange={(v) => updateCase({ procedureType: v })} options={["RCT", "Retreatment", "Emergency pulpectomy"]} />
                    <SelectInput label="Visit status" value={getCaseStatus(caseData)} onChange={(v) => updateCase({ caseStatus: v })} options={caseStatusOptions} />
                    <button onClick={applySuggestedCaseStatus} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Use suggested status</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Diagnosis / plan</h3>
                  <div className="grid gap-3">
                    <TextInput label="Pulpal diagnosis" value={caseData.diagnosis?.pulpal || ""} onChange={(v) => updateDiagnosis("pulpal", v)} placeholder="optional" />
                    <TextInput label="Apical diagnosis" value={caseData.diagnosis?.apical || ""} onChange={(v) => updateDiagnosis("apical", v)} placeholder="optional" />
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Next visit / plan</span><textarea value={caseData.nextVisitPlan || ""} onChange={(e) => updateCase({ nextVisitPlan: e.target.value })} placeholder="e.g., continue obturation, crown recommended, refer" className="h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Saved cases / JSON</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <button onClick={startNewCase} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">New case</button>
                  <button onClick={downloadCaseJson} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100">Download case JSON</button>
                  <button onClick={() => setShowImportBox((value) => !value)} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">Import case JSON</button>
                  <div className="flex gap-2">
                    <button onClick={clearSavedCurrentCase} className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100">Clear current</button>
                    <button onClick={resetAllSavedCases} className="flex-1 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Reset all</button>
                  </div>
                </div>
                {showImportBox ? <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-2"><textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste exported case JSON here" className="h-28 w-full rounded-lg border border-blue-100 bg-white p-2 font-mono text-xs outline-none focus:border-blue-300" /><button onClick={importCaseJson} className="mt-2 rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">Load pasted JSON</button></div> : null}

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent autosaves</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {savedCases.length ? savedCases.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-2"><button onClick={() => loadSavedCase(item.id)} className="w-full rounded-lg p-1 text-left text-xs text-slate-700 hover:bg-slate-100"><strong>{item.patientNumber}</strong> · tooth {item.tooth} · {item.procedureType}<span className="mt-1 block text-slate-500">{new Date(item.autosavedAt).toLocaleString()} · {item.canalCount || 0} canal(s) · {item.eventCount || 0} event(s)</span></button><button onClick={() => deleteSavedCase(item.id)} className="mt-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50">Delete saved case</button></div>) : <p className="text-sm text-slate-500">No autosaves yet.</p>}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {isProgressDetailOpen ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-950/30 p-4">
            <button
              aria-label="Close phase details"
              onClick={() => setIsProgressDetailOpen(false)}
              className="absolute inset-0"
            />
            <section className="relative mt-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Phase / canal map</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">{progressPhase}</h2>
                  <p className="mt-1 text-sm text-slate-600">Inspect phase progress by canal. Selecting a canal changes the active canal, but does not advance the workflow.</p>
                </div>
                <button
                  onClick={() => setIsProgressDetailOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                {phases.map((phase, idx) => {
                  const indicator = getGlobalPhaseIndicator(caseData, phase, currentNode.phase);
                  const isSelected = phase === progressPhase;
                  return (
                    <button
                      key={phase}
                      onClick={() => setSelectedProgressPhase(phase)}
                      className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-white text-slate-900" : indicator.className}`}>{idx + 1}</span>
                      <span className={`min-w-0 truncate text-sm ${isSelected ? "font-semibold text-white" : indicator.textClassName}`}>{phase}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected phase</p>
                    <h3 className="text-lg font-bold text-slate-950">{progressPhase}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-900 bg-slate-900 px-2 py-1 text-white">● Current</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">✓ Recorded</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-500">· Not recorded</span>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {caseData.canals.map((canal) => {
                    const indicator = getCanalPhaseIndicator(caseData, canal.name, progressPhase, currentNode.phase, caseData.currentCanal);
                    return (
                      <button
                        key={`${progressPhase}-${canal.name}`}
                        onClick={() => selectCanal(canal.name)}
                        className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${indicator.className}`}
                        title={`${canal.name} · ${progressPhase}: ${indicator.label}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong>{canal.name}</strong>
                          <span className="text-lg font-black">{indicator.symbol}</span>
                        </div>
                        <div className="mt-1 text-xs opacity-80">{statusLabels[getCanalStatus(canal)]}</div>
                        <div className="mt-2 text-[11px] leading-4 opacity-75">{formatCanalMeasurements(canal) || "No measurements yet"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
