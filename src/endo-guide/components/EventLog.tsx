import React from "react";
import type { ClinicalEvent } from "../types";
import { eventFragment } from "../notes/fragments";
import { SectionCard } from "./FormControls";

export function EventLog({ events }: { events: ClinicalEvent[] }) {
  return (
    <SectionCard title="Recent event log" className="lg:order-1 xl:order-none">
      {events.length ? (
        <div className="max-h-56 space-y-2 overflow-auto pr-1">
          {[...events].reverse().slice(0, 8).map((event) => (
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
  );
}
