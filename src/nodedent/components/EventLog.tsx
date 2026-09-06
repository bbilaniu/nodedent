import React from "react";
import type { ClinicalEvent } from "../types";
import { eventFragment } from "../notes/fragments";
import { SectionCard } from "./FormControls";
import { cx, semanticStatusSurface } from "./uiStyles";

export function EventLog({ events }: { events: ClinicalEvent[] }) {
  return (
    <SectionCard title="Recent event log" className="lg:order-1 xl:order-none">
      {events.length ? (
        <ol aria-label="Recent clinical events" className="max-h-56 space-y-2 overflow-auto pr-1">
          {[...events].reverse().slice(0, 8).map((event) => (
            <li key={event.id} className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-brand-navy">{event.type}</strong>
                <time dateTime={event.timestamp} className="text-xs text-brand-slate">{new Date(event.timestamp).toLocaleTimeString()}</time>
              </div>
              <p className="mt-1 text-xs text-brand-slate">{eventFragment(event)}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={cx(semanticStatusSurface.neutral, "rounded-xl p-3 text-sm")}>No events yet. Select a decision to start the note trail.</p>
      )}
    </SectionCard>
  );
}
