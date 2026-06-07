import type { ClinicalEvent, EndoCase } from "../types";

export function eventFragment(event: ClinicalEvent) {
  const canal = event.canal ? `${event.canal}: ` : "";
  const snap = event.details?.canalSnapshot || {};
  const fragments: Record<string, string> = {
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
    "workingLength.established": `${canal}WL established: EAL0 ${snap.eal0 || "___"} mm, patency ${snap.patencyLength || "___"} mm, shaping ${snap.shapingLength || "___"} mm, reference ${snap.referencePoint || "___"}, WL PA ${snap.wlRadiographStatus || "___"}.`,
    "troubleshooting.fileResistance": `${canal}File resistance noted.`,
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
    "smearLayer.deferred": `${canal}Smear layer removal deferred; medication/temporization pathway selected.`,
    "smearLayer.agitationDeferred": `${canal}EDTA agitation was not predictable; medication/temporization pathway selected.`,
    "disinfection.finalNaOClCompleted": `${canal}Final NaOCl disinfection completed.`,
    "disinfection.cannotCompleteToday": `${canal}Final disinfection/obturation could not be completed today.`,
    "disinfection.readyForObturation": `${canal}Canal ready for obturation gauging.`,
    "obturationGauge.size30Stop": `${canal}Size 30 NiTi hand file reached shaping length and did not advance beyond under firm pressure.`,
    "obturationGauge.size30AdvancesBeyond": `${canal}Size 30 NiTi hand file advanced beyond shaping length under firm pressure; larger gauge selected.`,
    "obturationGauge.size30Short": `${canal}Size 30 NiTi hand file did not reach shaping length; size 25 gauge selected.`,
    "obturationGauge.size25Stop": `${canal}Size 25 NiTi hand file reached shaping length and did not advance beyond under firm pressure.`,
    "obturationGauge.size25AdvancesBeyond": `${canal}Size 25 NiTi hand file advanced beyond shaping length under firm pressure; larger gauge selected.`,
    "obturationGauge.size25Short": `${canal}Size 25 NiTi hand file did not reach shaping length; returned to patency/shaping pathway.`,
    "obturationGauge.largerSizeStop": `${canal}Larger NiTi hand file reached shaping length and did not advance beyond under firm pressure.`,
    "obturationGauge.largerSizeAdvancesBeyond": `${canal}Larger NiTi hand file continued to advance beyond shaping length; continued sequential gauging.`,
    "obturationGauge.recorded": `${canal}Obturation gauge recorded as ${snap.obturationGauge || "___"}.`,
    "coneFit.masterConeFits": `${canal}Master cone selected as ${snap.masterCone || "___"} and fit to shaping length.`,
    "coneFit.masterConeShort": `${canal}Master cone was short of shaping length; short-cone troubleshooting selected.`,
    "coneFit.masterConeLong": `${canal}Master cone advanced beyond shaping length; long-cone troubleshooting selected.`,
    "coneFit.smallerConeFits": `${canal}One-size-smaller master cone fit to shaping length.`,
    "coneFit.smallerConeStillShort": `${canal}One-size-smaller master cone remained short; returned to final shaping pathway.`,
    "coneFit.smallerConeLong": `${canal}One-size-smaller master cone advanced beyond shaping length; long-cone troubleshooting selected.`,
    "coneFit.trimmedConeFits": `${canal}Long master cone was crimped, measured, trimmed, and fit to shaping length.`,
    "coneFit.trimmedConeStillNotFit": `${canal}Trimmed master cone still did not fit; short-cone troubleshooting selected.`,
    "coneFit.coneStillLong": `${canal}Master cone remained long after trimming; repeated long-cone troubleshooting.`,
    "coneFit.radiographAcceptable": `${canal}Cone fit radiograph acceptable.`,
    "coneFit.radiographShort": `${canal}Cone fit radiograph showed short cone position; short-cone troubleshooting selected.`,
    "coneFit.radiographLong": `${canal}Cone fit radiograph showed long cone position; long-cone troubleshooting selected.`,
    "coneFit.readyForSealerConeSeating": `${canal}Cone fit complete; ready for sealer and cone seating workflow.`,
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

export function groupEventsByPrefix(caseData: EndoCase, prefixes: string[]) {
  return (caseData.globalEvents || [])
    .filter((event) => prefixes.some((prefix) => event.type.startsWith(prefix)))
    .map(eventFragment);
}

export function appendSection(lines: string[], title: string, items: string[]) {
  lines.push(title);
  if (!items.length) lines.push("- Not recorded.");
  else items.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
}
