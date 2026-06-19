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
