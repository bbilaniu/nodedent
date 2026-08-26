type ClassValue = string | false | null | undefined;

export function cx(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ");
}

export type ActionRole = "primary" | "secondary" | "warning" | "destructive";
export type ActionSize = "compact" | "default" | "large" | "decision";
export type ChoiceState = "selected" | "unselected";
export type StatusRole = "positive" | "attention" | "neutral" | "difficulty" | "danger";

/** Interaction treatments stay independent from color semantics. */
export const semanticInteraction = {
  focus: "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-blue",
  disabled: "disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-brand-light-slate disabled:text-brand-slate disabled:shadow-none",
  loading: "cursor-wait",
};

const actionBase = cx(
  "semantic-control group inline-flex items-center justify-center gap-2 border font-semibold transition-colors duration-150",
  semanticInteraction.focus,
  semanticInteraction.disabled,
);

const actionRoleClasses: Record<ActionRole, string> = {
  primary: "semantic-action-primary border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep active:bg-brand-navy-deep active:shadow-inner",
  secondary: "semantic-action-secondary border-brand-light-node bg-white text-brand-navy hover:border-brand-blue-light hover:bg-brand-light-slate active:bg-brand-light-node",
  warning: "semantic-action-warning border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300 hover:bg-amber-100 active:bg-amber-100",
  destructive: "semantic-action-destructive border-red-700 bg-red-700 text-white hover:bg-red-800 active:bg-red-900 active:shadow-inner",
};

const actionSizeClasses: Record<ActionSize, string> = {
  compact: "min-h-10 rounded-xl px-3 py-2 text-xs",
  default: "min-h-11 rounded-xl px-3 py-2 text-sm",
  large: "min-h-12 rounded-xl px-4 py-3 text-sm",
  decision: "min-h-14 w-full flex-col items-start justify-center rounded-2xl p-4 text-left text-sm shadow-sm",
};

export function getActionButtonClass(role: ActionRole, size: ActionSize = "default") {
  return cx(actionBase, actionSizeClasses[size], actionRoleClasses[role]);
}

/** Shared action contract. Names describe prominence or consequence, not color. */
export const semanticActionButton = {
  primary: getActionButtonClass("primary"),
  primaryCompact: getActionButtonClass("primary", "compact"),
  primaryLarge: getActionButtonClass("primary", "large"),
  primaryDecision: getActionButtonClass("primary", "decision"),
  secondary: getActionButtonClass("secondary"),
  secondaryCompact: getActionButtonClass("secondary", "compact"),
  secondaryLarge: getActionButtonClass("secondary", "large"),
  secondaryDecision: getActionButtonClass("secondary", "decision"),
  warning: getActionButtonClass("warning"),
  destructive: getActionButtonClass("destructive"),
};

const choiceBase = cx(
  "semantic-control inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors duration-150",
  semanticInteraction.focus,
  semanticInteraction.disabled,
);

export const semanticSelectionTone: Record<ChoiceState, string> = {
  selected: "semantic-selection-selected border-brand-blue bg-brand-blue-light/20 text-brand-navy",
  unselected: "semantic-selection-unselected border-brand-light-node bg-white text-brand-navy",
};

const choiceStateClasses: Record<ChoiceState, string> = {
  selected: cx("semantic-choice-selected shadow-sm hover:bg-brand-blue-light/30 active:bg-brand-blue-light/30", semanticSelectionTone.selected),
  unselected: cx("semantic-choice-unselected text-brand-navy hover:border-brand-blue-light hover:bg-brand-light-slate active:bg-brand-light-node", semanticSelectionTone.unselected),
};

export function getChoiceControlClass(state: ChoiceState) {
  return cx(choiceBase, choiceStateClasses[state]);
}

/** Selected choices stay distinct from solid primary actions and mint status. */
export const semanticChoiceControl = {
  selected: getChoiceControlClass("selected"),
  unselected: getChoiceControlClass("unselected"),
  indicator: "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs font-bold leading-none",
  indicatorSelected: "border-brand-blue bg-brand-blue text-white",
  indicatorUnselected: "border-brand-light-node bg-white text-transparent",
};

export const semanticSelectionSurface = {
  selected: cx("rounded-2xl border p-4", semanticSelectionTone.selected),
  unselected: cx("rounded-2xl border p-4", semanticSelectionTone.unselected),
};

const formControlBase = "w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2";

export const semanticFormControl = {
  default: cx(formControlBase, "border-brand-light-node focus:border-brand-blue focus:ring-brand-blue-light/20"),
  invalid: cx(formControlBase, "border-red-300 focus:border-red-400 focus:ring-red-100"),
};

export const semanticStatusTone: Record<StatusRole, string> = {
  positive: "semantic-status-positive border-brand-mint/40 bg-brand-mint/10 text-brand-navy",
  attention: "semantic-status-attention border-amber-200 bg-amber-50 text-amber-900",
  neutral: "semantic-status-neutral border-brand-light-node bg-white text-brand-slate",
  difficulty: "semantic-status-difficulty border-orange-200 bg-orange-50 text-orange-900",
  danger: "semantic-status-danger border-red-200 bg-red-50 text-red-800",
};

const statusSurfaceBase = "semantic-status-surface rounded-2xl border";

/** Non-interactive status and notice surfaces stay visually distinct from controls. */
export const semanticStatusSurface: Record<StatusRole, string> = {
  positive: cx(statusSurfaceBase, semanticStatusTone.positive),
  attention: cx(statusSurfaceBase, semanticStatusTone.attention),
  neutral: cx(statusSurfaceBase, semanticStatusTone.neutral),
  difficulty: cx(statusSurfaceBase, semanticStatusTone.difficulty),
  danger: cx(statusSurfaceBase, semanticStatusTone.danger),
};

const headerButtonBase = "shrink-0 rounded-full leading-none";

export const headerActionButton = {
  primary: cx(getActionButtonClass("primary"), headerButtonBase, "px-4"),
  secondary: cx(getActionButtonClass("secondary"), headerButtonBase, "px-4"),
  secondaryCompact: cx(getActionButtonClass("secondary"), headerButtonBase, "px-3"),
  warning: cx(getActionButtonClass("warning"), headerButtonBase, "px-4"),
};

/** Transitional aliases for surface families not yet migrated by name. */
export const panelActionButton = {
  primary: semanticActionButton.primary,
  primaryCompact: semanticActionButton.primaryCompact,
  secondary: semanticActionButton.secondary,
  secondaryCompact: semanticActionButton.secondaryCompact,
  secondaryLarge: semanticActionButton.secondaryLarge,
  secondaryMuted: cx(semanticActionButton.secondary, "text-brand-slate"),
  muted: cx(semanticActionButton.secondary, "bg-brand-light-slate text-brand-slate hover:bg-brand-light-node"),
  warning: semanticActionButton.warning,
  danger: cx(getActionButtonClass("warning"), "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 active:bg-red-100"),
  destructive: semanticActionButton.destructive,
};

export const formControlActionButton = cx(getActionButtonClass("secondary"), "shrink-0 text-sm font-semibold leading-5");

export const workflowDecisionButton = semanticActionButton.secondaryDecision;

export const panelSurface = {
  card: "rounded-2xl border border-brand-light-node bg-white shadow-sm",
  cardPadded: "rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm",
  cardPaddedLarge: "rounded-2xl border border-brand-light-node bg-white p-5 shadow-sm",
  muted: "rounded-2xl border border-brand-light-node bg-brand-light-slate p-4",
  mutedFocusable: cx("rounded-2xl border border-brand-light-node bg-brand-light-slate p-4", semanticInteraction.focus),
  success: "rounded-2xl border border-brand-mint/40 bg-brand-mint/10 p-4 shadow-sm",
};

export const workspaceSurface = {
  shell: "w-full max-w-6xl rounded-3xl border border-brand-light-node bg-white p-5",
  statusTile: "rounded-xl border px-3 py-2",
  launcherCard: "rounded-xl border border-brand-light-node bg-brand-light-slate p-3",
};

export const statusBadge = {
  base: "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
  positive: semanticStatusTone.positive,
  ready: semanticStatusTone.positive,
  attention: semanticStatusTone.attention,
  neutral: semanticStatusTone.neutral,
  difficulty: semanticStatusTone.difficulty,
  danger: semanticStatusTone.danger,
};

export const sectionText = {
  eyebrow: "text-xs font-bold uppercase tracking-[0.18em] text-brand-slate",
  title: "mt-1 text-base font-semibold text-brand-navy",
  titleSmall: "text-sm font-semibold text-brand-navy",
  description: "mt-1 text-sm leading-6 text-brand-slate",
  descriptionSmall: "mt-1 text-xs leading-5 text-brand-slate",
};
