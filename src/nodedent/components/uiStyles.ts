type ClassValue = string | false | null | undefined;

export function cx(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ");
}

const headerButtonBase = "inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold leading-none transition";
const headerButtonDefaultSize = "px-4 py-2";
const headerButtonCompactSize = "px-3 py-1.5";

export const headerActionButton = {
  primary: cx(headerButtonBase, headerButtonDefaultSize, "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep"),
  secondary: cx(headerButtonBase, headerButtonDefaultSize, "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"),
  secondaryCompact: cx(headerButtonBase, headerButtonCompactSize, "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"),
  info: cx(headerButtonBase, headerButtonDefaultSize, "border-brand-blue-light bg-brand-blue-light/20 text-brand-navy hover:bg-brand-blue-light/30"),
  mint: cx(headerButtonBase, headerButtonDefaultSize, "border-brand-mint/50 bg-brand-mint/15 text-brand-navy hover:bg-brand-mint/25"),
  warning: cx(headerButtonBase, headerButtonDefaultSize, "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"),
};

const panelButtonBase = "rounded-xl border font-semibold transition";
const panelButtonDefaultSize = "px-3 py-2 text-sm";

export const panelActionButton = {
  primary: cx(panelButtonBase, panelButtonDefaultSize, "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep"),
  primaryCompact: cx(panelButtonBase, "px-3 py-2 text-xs", "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep"),
  secondary: cx(panelButtonBase, panelButtonDefaultSize, "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"),
  secondaryMuted: cx(panelButtonBase, panelButtonDefaultSize, "border-brand-light-node bg-white text-brand-slate hover:bg-brand-light-slate"),
  muted: cx(panelButtonBase, panelButtonDefaultSize, "border-brand-light-node bg-brand-light-slate text-brand-slate hover:bg-brand-light-node"),
  info: cx(panelButtonBase, panelButtonDefaultSize, "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-blue-light/20"),
  infoLarge: cx(panelButtonBase, "px-3 py-3 text-sm font-bold", "border-dashed border-brand-blue bg-white text-brand-navy hover:bg-brand-blue-light/30"),
  success: cx(panelButtonBase, panelButtonDefaultSize, "border-brand-mint/50 bg-brand-mint/15 text-brand-navy hover:bg-brand-mint/25"),
  warning: cx(panelButtonBase, panelButtonDefaultSize, "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"),
  danger: cx(panelButtonBase, panelButtonDefaultSize, "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"),
  destructive: cx(panelButtonBase, panelButtonDefaultSize, "border-red-700 bg-red-700 text-white hover:bg-red-800"),
};

export const panelSurface = {
  card: "rounded-2xl border border-brand-light-node bg-white shadow-sm",
  cardPadded: "rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm",
  cardPaddedLarge: "rounded-2xl border border-brand-light-node bg-white p-5 shadow-sm",
  muted: "rounded-2xl border border-brand-light-node bg-brand-light-slate p-4",
  mutedFocusable: "rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 outline-none ring-brand-mint/30 focus:ring-2",
  success: "rounded-2xl border border-brand-mint/40 bg-brand-mint/10 p-4 shadow-sm",
};

export const sectionText = {
  eyebrow: "text-xs font-bold uppercase tracking-[0.18em] text-brand-slate",
  title: "mt-1 text-base font-semibold text-brand-navy",
  titleSmall: "text-sm font-semibold text-brand-navy",
  description: "mt-1 text-sm leading-6 text-brand-slate",
  descriptionSmall: "mt-1 text-xs leading-5 text-brand-slate",
};
