import React, { type ReactNode } from "react";
import { cx, semanticActionButton } from "./uiStyles";

export function ImportDisclosure({
  action,
  buttonLabel,
  children,
  expanded,
  id,
  onToggle,
}: {
  action: ReactNode;
  buttonLabel: string;
  children: ReactNode;
  expanded: boolean;
  id: string;
  onToggle: () => void;
}) {
  const triggerId = `${id}-trigger`;

  return (
    <div className="mt-3">
      <div className="grid gap-3 md:grid-cols-2">
        {action}
        <button
          id={triggerId}
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={onToggle}
          className={cx(semanticActionButton.secondary, "w-full leading-5")}
        >
          <span>{buttonLabel}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
          </svg>
        </button>
      </div>
      <div
        id={id}
        role="region"
        aria-labelledby={triggerId}
        hidden={!expanded}
        className="mt-3 rounded-xl border border-brand-blue-light/60 bg-white p-3"
      >
        {children}
      </div>
    </div>
  );
}
