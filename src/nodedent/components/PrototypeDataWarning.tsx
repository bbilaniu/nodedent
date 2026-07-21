import React from "react";

export function PrototypeDataWarning({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <aside
      aria-label="Prototype data warning"
      className={`rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 ${compact ? "px-3 py-2" : "p-4"} ${className}`}
    >
      <p className="text-sm font-bold">Prototype only — do not enter identifiable patient information</p>
      <p className="mt-1 text-xs leading-5">
        Use synthetic case details. Records are stored in this browser. Full JSON exports contain the case record, and the patient number is included in the filename.
      </p>
    </aside>
  );
}
