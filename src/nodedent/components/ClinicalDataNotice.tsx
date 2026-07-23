import React from "react";

export function ClinicalDataNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      aria-label="Clinical data storage and export notice"
      className={`rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 ${compact ? "px-3 py-2" : "p-4"}`}
    >
      <p className="text-sm font-bold">Identifying clinical information</p>
      <p className="mt-1 text-xs leading-5">
        NodeDent stores chart numbers and case details in this clinic browser profile until they are deleted. The locked vault is encrypted, but copied or downloaded text and JSON are plaintext. EMRs such as ClearDent or Dentrix remain the official record. Do not enter names, exact birth dates, contact details, government health numbers, or insurance identifiers. Clinical deployment still requires the clinic's privacy and operational approval.
      </p>
    </aside>
  );
}
