export const phases = [
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

export const phaseProgressRules: Record<string, string[]> = {
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

export function eventMatchesRule(eventType: string, rule: string) {
  return rule.endsWith(".") ? eventType.startsWith(rule) : eventType === rule || eventType.startsWith(rule);
}
