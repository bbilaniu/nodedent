import React, { useEffect, useRef, useState } from "react";
import type { CanalRecord, CaseSetupFocusTarget, ClinicalEvent, EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { isBlank } from "../engine/measurements";
import { caseStatusOptions } from "../state/persistence";
import type { AnesthesiaEventDetails, AnesthesiaEventType } from "../workflow/anesthesia";
import { anesthesiaEventTypes, formatAnesthesiaEventFragment } from "../workflow/anesthesia";
import type { AnesthesiaCatalogField } from "../workflow/anesthesiaCatalog";
import { createUserAnesthesiaCatalogItem, createUserAnesthesiaCatalogOverride, getAnesthesiaCatalogItems, seedAnesthesiaCatalogItems } from "../workflow/anesthesiaCatalog";
import type { AnesthesiaEventOptions } from "../workflow/anesthesiaForm";
import { anesthesiaRouteFromLabel, anesthesiaRouteLabels, anesthesiaRouteOptions } from "../workflow/anesthesiaForm";
import type { CatalogItem } from "../workflow/catalogs";
import { getCatalogItems } from "../workflow/catalogs";
import type { IsolationEventDetails, IsolationEventType } from "../workflow/isolation";
import { formatIsolationEventFragment, getIsolationCoverageSummary } from "../workflow/isolation";
import type { IsolationCatalogField } from "../workflow/isolationCatalog";
import { createUserIsolationCatalogItem, createUserIsolationCatalogOverride, getIsolationCatalogItems, seedIsolationCatalogItems } from "../workflow/isolationCatalog";
import { createOperativeSetupScope, type OperativeWorkflowSetupState } from "../workflow/operative";
import type { CapabilityStatus } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { getWorkflowTargetPanelKind } from "../workflow/targetPanels";
import { AnesthesiaEventForm } from "./AnesthesiaEventForm";
import { EndodonticWorkflowSetupPanel } from "./EndodonticWorkflowSetupPanel";
import { IsolationEventForm } from "./IsolationEventForm";
import { SelectInput, TextInput } from "./FormControls";
import { cx, panelActionButton, panelSurface, sectionText } from "./uiStyles";

function statusClass(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "border-amber-200 bg-amber-50 text-amber-900";
  if (satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

const anesthesiaCatalogFieldLabels = {
  agents: "Agent",
  techniques: "Technique",
  applicationTypes: "Application type",
  doseUnits: "Dose unit",
  vasoconstrictors: "Vasoconstrictor",
  vasoconstrictorDoses: "Vasoconstrictor dose",
  routeLabels: "Route label",
} as const satisfies Record<AnesthesiaCatalogField, string>;

const anesthesiaCatalogFieldOptions = Object.values(anesthesiaCatalogFieldLabels);

const isolationCatalogFieldLabels = {
  methodLabels: "Method label",
  supportTypes: "Support type",
  supportPhrases: "Support phrase",
  regionLabels: "Region label",
  reasons: "Reason",
  notes: "Note phrase",
  clampCodes: "Clamp code",
} as const satisfies Record<IsolationCatalogField, string>;

const isolationCatalogFieldOptions = Object.values(isolationCatalogFieldLabels);
type CatalogPanelKind = "anesthesia" | "isolation";

function anesthesiaCatalogFieldFromLabel(label: string): AnesthesiaCatalogField {
  const entry = Object.entries(anesthesiaCatalogFieldLabels).find(([, fieldLabel]) => fieldLabel === label);
  return (entry?.[0] as AnesthesiaCatalogField | undefined) || "agents";
}

function labelForAnesthesiaCatalogField(field: AnesthesiaCatalogField) {
  return anesthesiaCatalogFieldLabels[field];
}

function isolationCatalogFieldFromLabel(label: string): IsolationCatalogField {
  const entry = Object.entries(isolationCatalogFieldLabels).find(([, fieldLabel]) => fieldLabel === label);
  return (entry?.[0] as IsolationCatalogField | undefined) || "clampCodes";
}

function labelForIsolationCatalogField(field: IsolationCatalogField) {
  return isolationCatalogFieldLabels[field];
}

function updateUserCatalogItem(items: CatalogItem[], nextItem: CatalogItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [...items, nextItem];
  return items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
}

function updateUserCatalogItems(items: CatalogItem[], nextItems: CatalogItem[]) {
  return nextItems.reduce(updateUserCatalogItem, items);
}

function getVisibleAnesthesiaCatalogRows(items: CatalogItem[], route: string, field: AnesthesiaCatalogField) {
  const merged = getAnesthesiaCatalogItems(items);
  const ordered = getCatalogItems(merged, { category: "anesthesia", route, field });
  const inactiveOverrides = items.filter((item) => (
    item.category === "anesthesia" &&
    item.active === false &&
    item.appliesTo?.route === route &&
    item.appliesTo?.field === field
  ));
  return [...ordered, ...inactiveOverrides.filter((item) => !ordered.some((orderedItem) => orderedItem.id === item.id))];
}

function getVisibleIsolationCatalogRows(items: CatalogItem[], field: IsolationCatalogField) {
  const merged = getIsolationCatalogItems(items);
  const ordered = getCatalogItems(merged, { category: "isolation", field });
  const inactiveOverrides = items.filter((item) => (
    item.category === "isolation" &&
    item.active === false &&
    item.appliesTo?.field === field
  ));
  return [...ordered, ...inactiveOverrides.filter((item) => !ordered.some((orderedItem) => orderedItem.id === item.id))];
}

function AnesthesiaCatalogManager({
  userCatalogItems,
  onChange,
}: {
  userCatalogItems: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
}) {
  const [routeLabel, setRouteLabel] = useState<string>(anesthesiaRouteLabels.injection);
  const [fieldLabel, setFieldLabel] = useState<string>(labelForAnesthesiaCatalogField("techniques"));
  const [label, setLabel] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [editingLabel, setEditingLabel] = useState("");
  const route = anesthesiaRouteFromLabel(routeLabel);
  const field = anesthesiaCatalogFieldFromLabel(fieldLabel);
  const rows = getVisibleAnesthesiaCatalogRows(userCatalogItems, route, field);

  function addShortcut() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const nextItem = createUserAnesthesiaCatalogItem({
      route,
      field,
      label: trimmed,
      favorite: true,
      sortOrder: 1,
    });
    onChange(updateUserCatalogItem(userCatalogItems, nextItem));
    setLabel("");
  }

  function startEdit(item: CatalogItem) {
    setEditingItemId(item.id);
    setEditingLabel(item.label);
  }

  function saveEdit(item: CatalogItem) {
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    onChange(updateUserCatalogItem(userCatalogItems, { ...item, label: trimmed }));
    setEditingItemId("");
    setEditingLabel("");
  }

  function deleteUserItem(item: CatalogItem) {
    onChange(userCatalogItems.filter((candidate) => candidate.id !== item.id));
    if (editingItemId === item.id) {
      setEditingItemId("");
      setEditingLabel("");
    }
  }

  function toggleFavorite(item: CatalogItem) {
    const nextItem = createUserAnesthesiaCatalogOverride(item, {
      active: item.active !== false,
      favorite: !item.favorite,
    });
    onChange(updateUserCatalogItem(userCatalogItems, nextItem));
  }

  function toggleActive(item: CatalogItem) {
    const nextItem = createUserAnesthesiaCatalogOverride(item, {
      active: item.active === false,
      favorite: item.favorite,
    });
    onChange(updateUserCatalogItem(userCatalogItems, nextItem));
  }

  return (
    <div className="mt-4 rounded-xl border border-brand-light-node bg-white p-3">
      <p className="mb-3 text-xs leading-5 text-brand-slate">
        Favorites appear first in the selected field's suggestions. Seed rows can be hidden or favorited with user overrides; user rows can also be edited or deleted.
      </p>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
        <SelectInput label="Route" value={routeLabel} onChange={setRouteLabel} options={anesthesiaRouteOptions} />
        <SelectInput label="Field" value={fieldLabel} onChange={setFieldLabel} options={anesthesiaCatalogFieldOptions} />
        <TextInput label="Shortcut" value={label} onChange={setLabel} placeholder="custom text" />
        <button
          type="button"
          onClick={addShortcut}
          disabled={!label.trim()}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${label.trim() ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "cursor-not-allowed border-brand-light-node bg-brand-light-slate text-brand-slate"}`}
        >
          Add
        </button>
      </div>
      {rows.length ? (
        <div className="mt-3 grid gap-2">
          {rows.map((item) => {
            const seedItem = seedAnesthesiaCatalogItems.find((candidate) => candidate.id === item.id);
            const ownerLabel = seedItem && item.owner === "user" ? "Seed override" : item.owner === "seed" ? "Seed" : "User";
            const canEditOrDelete = item.owner === "user" && !seedItem;
            const editing = editingItemId === item.id;
            return (
              <div key={item.id} className={`flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${item.active === false ? "border-brand-light-node bg-brand-light-slate text-brand-slate" : "border-brand-light-node bg-white text-brand-navy"}`}>
                <div className="min-w-0">
                  {editing ? (
                    <TextInput label="Edit shortcut" value={editingLabel} onChange={setEditingLabel} placeholder="custom text" />
                  ) : (
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                  )}
                  <p className="text-xs leading-5 text-brand-slate">{ownerLabel}{item.favorite ? " · Favorite" : ""}{item.active === false ? " · Hidden" : ""}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {editing ? (
                    <>
                      <button type="button" onClick={() => saveEdit(item)} className="rounded-lg border border-brand-navy bg-brand-navy px-2 py-1 text-xs font-semibold text-white hover:bg-brand-navy-deep">
                        Save
                      </button>
                      <button type="button" onClick={() => { setEditingItemId(""); setEditingLabel(""); }} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => toggleFavorite(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                        {item.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                      <button type="button" onClick={() => toggleActive(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                        {item.active === false ? "Show" : "Hide"}
                      </button>
                      {canEditOrDelete ? (
                        <>
                          <button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteUserItem(item)} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </>
                      ) : seedItem && item.owner === "user" ? (
                        <button type="button" onClick={() => deleteUserItem(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                          Reset
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function IsolationCatalogManager({
  userCatalogItems,
  onChange,
}: {
  userCatalogItems: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
}) {
  const [fieldLabel, setFieldLabel] = useState<string>(labelForIsolationCatalogField("clampCodes"));
  const [label, setLabel] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [editingLabel, setEditingLabel] = useState("");
  const field = isolationCatalogFieldFromLabel(fieldLabel);
  const rows = getVisibleIsolationCatalogRows(userCatalogItems, field);

  function addShortcut() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const nextItem = createUserIsolationCatalogItem({
      field,
      label: trimmed,
      favorite: true,
      sortOrder: 1,
    });
    onChange(updateUserCatalogItem(userCatalogItems, nextItem));
    setLabel("");
  }

  function startEdit(item: CatalogItem) {
    setEditingItemId(item.id);
    setEditingLabel(item.label);
  }

  function saveEdit(item: CatalogItem) {
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    onChange(updateUserCatalogItem(userCatalogItems, { ...item, label: trimmed }));
    setEditingItemId("");
    setEditingLabel("");
  }

  function deleteUserItem(item: CatalogItem) {
    onChange(userCatalogItems.filter((candidate) => candidate.id !== item.id));
    if (editingItemId === item.id) {
      setEditingItemId("");
      setEditingLabel("");
    }
  }

  function toggleFavorite(item: CatalogItem) {
    const nextItem = createUserIsolationCatalogOverride(item, {
      active: item.active !== false,
      favorite: !item.favorite,
    });
    onChange(updateUserCatalogItem(userCatalogItems, nextItem));
  }

  function toggleActive(item: CatalogItem) {
    const nextItem = createUserIsolationCatalogOverride(item, {
      active: item.active === false,
      favorite: item.favorite,
    });
    onChange(updateUserCatalogItem(userCatalogItems, nextItem));
  }

  return (
    <div className="mt-4 rounded-xl border border-brand-light-node bg-white p-3">
      <p className="mb-3 text-xs leading-5 text-brand-slate">
        Favorites appear first in the selected field's suggestions. Seed rows can be hidden or favorited with user overrides; user rows can also be edited or deleted.
      </p>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_1.5fr_auto] md:items-end">
        <SelectInput label="Field" value={fieldLabel} onChange={setFieldLabel} options={isolationCatalogFieldOptions} />
        <TextInput label="Shortcut" value={label} onChange={setLabel} placeholder="custom text" />
        <button
          type="button"
          onClick={addShortcut}
          disabled={!label.trim()}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${label.trim() ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "cursor-not-allowed border-brand-light-node bg-brand-light-slate text-brand-slate"}`}
        >
          Add
        </button>
      </div>
      {rows.length ? (
        <div className="mt-3 grid gap-2">
          {rows.map((item) => {
            const seedItem = seedIsolationCatalogItems.find((candidate) => candidate.id === item.id);
            const ownerLabel = seedItem && item.owner === "user" ? "Seed override" : item.owner === "seed" ? "Seed" : "User";
            const canEditOrDelete = item.owner === "user" && !seedItem;
            const editing = editingItemId === item.id;
            return (
              <div key={item.id} className={`flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${item.active === false ? "border-brand-light-node bg-brand-light-slate text-brand-slate" : "border-brand-light-node bg-white text-brand-navy"}`}>
                <div className="min-w-0">
                  {editing ? (
                    <TextInput label="Edit shortcut" value={editingLabel} onChange={setEditingLabel} placeholder="custom text" />
                  ) : (
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                  )}
                  <p className="text-xs leading-5 text-brand-slate">{ownerLabel}{item.favorite ? " · Favorite" : ""}{item.active === false ? " · Hidden" : ""}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {editing ? (
                    <>
                      <button type="button" onClick={() => saveEdit(item)} className="rounded-lg border border-brand-navy bg-brand-navy px-2 py-1 text-xs font-semibold text-white hover:bg-brand-navy-deep">
                        Save
                      </button>
                      <button type="button" onClick={() => { setEditingItemId(""); setEditingLabel(""); }} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => toggleFavorite(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                        {item.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                      <button type="button" onClick={() => toggleActive(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                        {item.active === false ? "Show" : "Hide"}
                      </button>
                      {canEditOrDelete ? (
                        <>
                          <button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteUserItem(item)} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </>
                      ) : seedItem && item.owner === "user" ? (
                        <button type="button" onClick={() => deleteUserItem(item)} className="rounded-lg border border-brand-light-node bg-white px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-light-slate">
                          Reset
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type CaseSetupFocusRefs = Record<CaseSetupFocusTarget, React.RefObject<HTMLElement | null>>;

function formatEventTimestamp(timestamp?: string) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function focusCaseSetupSection(focusTarget: CaseSetupFocusTarget | null | undefined, focusRefs: CaseSetupFocusRefs) {
  if (!focusTarget) return;
  const section = focusRefs[focusTarget].current;
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
  section?.focus({ preventScroll: true });
}

function CaseSetupGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 lg:col-span-2">
      <div>
        <p className={sectionText.eyebrow}>Case Setup & Status</p>
        <h3 className={sectionText.title}>{title}</h3>
        <p className={sectionText.description}>{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function CaseIdentitySection({
  caseData,
  onUpdateCase,
}: {
  caseData: EndoCase;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
}) {
  return (
    <section className={panelSurface.muted}>
      <h3 className={sectionText.titleSmall}>Patient and procedure</h3>
      <div className="mt-3 grid gap-3">
        <TextInput label="Patient #" value={caseData.patientNumber} onChange={(value) => onUpdateCase({ patientNumber: value })} placeholder="chart number" />
        <TextInput label="Tooth" value={caseData.tooth} onChange={(value) => onUpdateCase({ tooth: value })} invalid={isBlank(caseData.tooth)} />
        <SelectInput label="Procedure" value={caseData.procedureType} onChange={(value) => onUpdateCase({ procedureType: value })} options={["RCT", "Retreatment", "Emergency pulpectomy"]} />
      </div>
    </section>
  );
}

function CaseVisitStatusSection({
  caseData,
  onUpdateCase,
  onApplySuggestedCaseStatus,
}: {
  caseData: EndoCase;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onApplySuggestedCaseStatus: () => void;
}) {
  return (
    <section className={panelSurface.muted}>
      <h3 className={sectionText.titleSmall}>Case visit status</h3>
      <div className="mt-3 grid gap-3">
        <SelectInput label="Visit status" value={getCaseStatus(caseData)} onChange={(value) => onUpdateCase({ caseStatus: value })} options={caseStatusOptions} />
        <button onClick={onApplySuggestedCaseStatus} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-xs font-semibold text-brand-slate hover:bg-brand-light-slate">Use suggested status</button>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-slate">Next visit / plan</span>
          <textarea
            value={caseData.nextVisitPlan || ""}
            onChange={(event) => onUpdateCase({ nextVisitPlan: event.target.value })}
            placeholder="e.g., continue obturation, crown recommended, refer"
            className="h-24 w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
          />
        </label>
      </div>
    </section>
  );
}

function DiagnosisReadinessSection({
  caseData,
  onUpdateDiagnosis,
  sectionRef,
}: {
  caseData: EndoCase;
  onUpdateDiagnosis: (field: string, value: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section ref={sectionRef} tabIndex={-1} className={panelSurface.mutedFocusable}>
      <h3 className={sectionText.titleSmall}>Diagnosis readiness</h3>
      <div className="mt-3 grid gap-3">
        <TextInput label="Pulpal diagnosis" value={caseData.diagnosis?.pulpal || ""} onChange={(value) => onUpdateDiagnosis("pulpal", value)} placeholder="optional" />
        <TextInput label="Apical diagnosis" value={caseData.diagnosis?.apical || ""} onChange={(value) => onUpdateDiagnosis("apical", value)} placeholder="optional" />
      </div>
    </section>
  );
}

function RadiographReadinessSection({
  caseData,
  paReviewed,
  bwReviewed,
  onUpdatePreOp,
  sectionRef,
}: {
  caseData: EndoCase;
  paReviewed: boolean;
  bwReviewed: boolean;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section ref={sectionRef} tabIndex={-1} className={panelSurface.mutedFocusable}>
      <h3 className={sectionText.titleSmall}>Radiograph readiness</h3>
      <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">Pre-op radiographs reviewed</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold text-brand-navy">
            <input type="checkbox" checked={paReviewed} onChange={(event) => onUpdatePreOp("paReviewed", event.target.checked)} />
            PA
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold text-brand-navy">
            <input type="checkbox" checked={bwReviewed} onChange={(event) => onUpdatePreOp("bwReviewed", event.target.checked)} />
            BW
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold text-brand-navy">
            <input type="checkbox" checked={Boolean(caseData.preOp?.cbctReviewed)} onChange={(event) => onUpdatePreOp("cbctReviewed", event.target.checked)} />
            CBCT
          </label>
        </div>
      </div>
    </section>
  );
}

function SharedClinicalReadinessSection({
  statusItems,
}: {
  statusItems: Array<{ label: string; status: CapabilityStatus }>;
}) {
  return (
    <section className={cx(panelSurface.muted, "lg:col-span-2")}>
      <h3 className={sectionText.titleSmall}>Shared clinical readiness</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusItems.map(({ label, status }) => (
          <div key={label} className={`rounded-xl border px-3 py-2 ${statusClass(status.satisfied, status.needsReassessment)}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                {status.needsReassessment ? "Review" : status.satisfied ? "Ready" : "Pending"}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-5">{status.summary}</p>
            {status.reason ? <p className="mt-1 text-xs leading-5 opacity-80">{status.reason}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function FloatingCatalogCard({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = `${title.toLowerCase().replace(/\s+/g, "-")}-catalog-title`;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-auto bg-brand-navy-deep/35 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mt-6 w-full max-w-4xl rounded-3xl border border-brand-light-node bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={sectionText.eyebrow}>Documentation catalog</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-brand-navy">{title}</h2>
            <p className={sectionText.description}>{description}</p>
          </div>
          <button type="button" onClick={onClose} className={panelActionButton.secondary}>
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function OperativeWorkflowSetupSummary({
  caseData,
  setup,
  onOpenOperativeWorkflowSetup,
}: {
  caseData: EndoCase;
  setup: OperativeWorkflowSetupState;
  onOpenOperativeWorkflowSetup?: () => void;
}) {
  const scope = createOperativeSetupScope(setup, caseData.tooth);
  const rows = [
    { label: "Scope", value: scope.label || "No tooth/surface scope yet" },
    { label: "Restoration intent", value: setup.restorationIntent || "Not recorded" },
    { label: "Material", value: setup.material || "Not recorded" },
    { label: "Shade", value: setup.shade || "Not recorded" },
  ];

  return (
    <section className={cx(panelSurface.muted, "lg:col-span-2")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={sectionText.titleSmall}>Operative setup summary</h3>
          <p className={sectionText.descriptionSmall}>Edit tooth and surface scope in the active operative workflow.</p>
        </div>
        <button
          type="button"
          onClick={onOpenOperativeWorkflowSetup}
          disabled={!onOpenOperativeWorkflowSetup}
          className="shrink-0 rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate"
        >
          Open operative workflow
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{row.label}</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy">{row.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CaseSetupStatusPanel({
  caseData,
  activeCanal,
  activeWorkflowId,
  operativeSetup,
  onUpdateCase,
  onUpdateDiagnosis,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplySuggestedCaseStatus,
  onRecordAnesthesiaEvent,
  onRecordIsolationEvent,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  onOpenOperativeWorkflowSetup,
  userAnesthesiaCatalogItems = [],
  onUserAnesthesiaCatalogItemsChange,
  userIsolationCatalogItems = [],
  onUserIsolationCatalogItemsChange,
  initialFocusSection,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  activeWorkflowId: string;
  operativeSetup?: OperativeWorkflowSetupState;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
  onRecordAnesthesiaEvent: (eventType: AnesthesiaEventType, details: AnesthesiaEventDetails, options?: AnesthesiaEventOptions) => void;
  onRecordIsolationEvent: (eventType: IsolationEventType, details: IsolationEventDetails) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  onOpenOperativeWorkflowSetup?: () => void;
  userAnesthesiaCatalogItems?: CatalogItem[];
  onUserAnesthesiaCatalogItemsChange?: (items: CatalogItem[]) => void;
  userIsolationCatalogItems?: CatalogItem[];
  onUserIsolationCatalogItemsChange?: (items: CatalogItem[]) => void;
  initialFocusSection?: CaseSetupFocusTarget | null;
}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ?? false;
  const bwReviewed = caseData.preOp?.bwReviewed ?? false;
  const workflowTargetPanelKind = getWorkflowTargetPanelKind(activeWorkflowId);
  const showEndodonticWorkflowSetup = workflowTargetPanelKind === "endodontic";
  const showOperativeWorkflowSetup = workflowTargetPanelKind === "operative" && Boolean(operativeSetup);
  const [activeCatalogPanel, setActiveCatalogPanel] = useState<CatalogPanelKind | null>(null);
  const anesthesiaSectionRef = useRef<HTMLElement | null>(null);
  const diagnosisSectionRef = useRef<HTMLElement | null>(null);
  const isolationSectionRef = useRef<HTMLElement | null>(null);
  const radiographsSectionRef = useRef<HTMLElement | null>(null);
  const focusRefs: CaseSetupFocusRefs = {
    diagnosis: diagnosisSectionRef,
    radiographs: radiographsSectionRef,
    anesthesia: anesthesiaSectionRef,
    isolation: isolationSectionRef,
  };
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const anesthesiaEvents = (caseData.globalEvents || []).filter((event) => Object.values(anesthesiaEventTypes).includes(event.type as AnesthesiaEventType));
  const latestAnesthesiaEvent = anesthesiaEvents.at(-1);
  const latestAnesthesiaEventTime = formatEventTimestamp(latestAnesthesiaEvent?.timestamp);
  const latestIsolationEvent = capabilitySummary.isolation.sourceEvent;
  const latestIsolationEventTime = formatEventTimestamp(latestIsolationEvent?.timestamp);
  const isolationCoverage = getIsolationCoverageSummary(latestIsolationEvent);
  const isolationCoverageItems = [
    { label: "Exposed teeth", value: isolationCoverage.exposedTeeth },
    { label: "Region", value: isolationCoverage.region },
    { label: "Clamp tooth", value: isolationCoverage.clampTooth },
    { label: "Clamp code", value: isolationCoverage.clampCode },
  ];
  const statusItems = [
    { label: "Diagnosis", status: capabilitySummary.diagnosis },
    { label: "Radiographs", status: capabilitySummary.radiographs },
    { label: "Anesthesia", status: capabilitySummary.anesthesia },
    { label: "Isolation", status: capabilitySummary.isolation },
  ];
  const anesthesiaIsEstablished = capabilitySummary.anesthesia.satisfied && !capabilitySummary.anesthesia.needsReassessment;
  const anesthesiaWorkflowEntryNodeId = anesthesiaIsEstablished || capabilitySummary.anesthesia.needsReassessment
    ? "anesthesia-needs-reassessment"
    : undefined;
  const isolationIsEstablished = capabilitySummary.isolation.satisfied && !capabilitySummary.isolation.needsReassessment;

  useEffect(() => {
    focusCaseSetupSection(initialFocusSection, focusRefs);
  }, [initialFocusSection]);

  return (
    <div className="grid gap-6">
      <CaseSetupGroup title="Case identity" description="Patient, tooth, procedure, visit status, and next-visit planning.">
        <CaseIdentitySection caseData={caseData} onUpdateCase={onUpdateCase} />
        <CaseVisitStatusSection caseData={caseData} onUpdateCase={onUpdateCase} onApplySuggestedCaseStatus={onApplySuggestedCaseStatus} />
      </CaseSetupGroup>

      <CaseSetupGroup title="Shared readiness" description="Reusable diagnosis, radiograph, anesthesia, and isolation context for the current workflow.">
        <DiagnosisReadinessSection caseData={caseData} onUpdateDiagnosis={onUpdateDiagnosis} sectionRef={diagnosisSectionRef} />
        <RadiographReadinessSection caseData={caseData} paReviewed={paReviewed} bwReviewed={bwReviewed} onUpdatePreOp={onUpdatePreOp} sectionRef={radiographsSectionRef} />
        <SharedClinicalReadinessSection statusItems={statusItems} />
      </CaseSetupGroup>

      {showEndodonticWorkflowSetup ? (
        <CaseSetupGroup title="Endodontic setup" description="Endodontic-only canal and measurement setup for the active RCT workflow.">
          <EndodonticWorkflowSetupPanel caseData={caseData} activeCanal={activeCanal} onUpdatePreOp={onUpdatePreOp} onUpdateActiveCanal={onUpdateActiveCanal} />
        </CaseSetupGroup>
      ) : null}

      {showOperativeWorkflowSetup && operativeSetup ? (
        <CaseSetupGroup title="Operative setup" description="Operative tooth, surface, material, and shade documentation for the active direct restoration workflow.">
          <OperativeWorkflowSetupSummary
            caseData={caseData}
            setup={operativeSetup}
            onOpenOperativeWorkflowSetup={onOpenOperativeWorkflowSetup}
          />
        </CaseSetupGroup>
      ) : null}

      <section ref={anesthesiaSectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "lg:col-span-2")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className={sectionText.titleSmall}>Anesthesia</h3>
            <p className={sectionText.description}>{capabilitySummary.anesthesia.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(capabilitySummary.anesthesia.satisfied, capabilitySummary.anesthesia.needsReassessment)}`}>
            {capabilitySummary.anesthesia.needsReassessment ? "Review" : capabilitySummary.anesthesia.satisfied ? "Ready" : "Pending"}
          </span>
        </div>
        {latestAnesthesiaEvent ? (
          <div className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest event</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatAnesthesiaEventFragment(latestAnesthesiaEvent)}</p>
            {latestAnesthesiaEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestAnesthesiaEventTime}</p> : null}
          </div>
        ) : null}
        <div className="mt-3">
          <button
            type="button"
            aria-label="Open embedded anesthesia workflow"
            onClick={() => onOpenAnesthesiaWorkflow(anesthesiaWorkflowEntryNodeId)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${anesthesiaIsEstablished ? "border-brand-blue-light bg-brand-blue-light/20 text-brand-navy hover:bg-brand-blue-light/30" : "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-blue-light/20"}`}
          >
            {anesthesiaIsEstablished || capabilitySummary.anesthesia.needsReassessment ? "Review anesthesia" : "Open anesthesia workflow"}
          </button>
        </div>
        <AnesthesiaEventForm
          tooth={caseData.tooth}
          latestEvent={latestAnesthesiaEvent}
          userCatalogItems={userAnesthesiaCatalogItems}
          onSaveCatalogItems={onUserAnesthesiaCatalogItemsChange ? (items) => onUserAnesthesiaCatalogItemsChange(updateUserCatalogItems(userAnesthesiaCatalogItems, items)) : undefined}
          onManageShortcuts={onUserAnesthesiaCatalogItemsChange ? () => setActiveCatalogPanel("anesthesia") : undefined}
          onRecordEvent={onRecordAnesthesiaEvent}
        />
      </section>

      <section ref={isolationSectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "lg:col-span-2")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className={sectionText.titleSmall}>Isolation</h3>
            <p className={sectionText.description}>{capabilitySummary.isolation.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(capabilitySummary.isolation.satisfied, capabilitySummary.isolation.needsReassessment)}`}>
            {capabilitySummary.isolation.needsReassessment ? "Review" : capabilitySummary.isolation.satisfied ? "Ready" : "Pending"}
          </span>
        </div>
        {latestIsolationEvent ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_1.85fr]">
            <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest event</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatIsolationEventFragment(latestIsolationEvent)}</p>
              {latestIsolationEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestIsolationEventTime}</p> : null}
            </div>
            <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Current coverage</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {isolationCoverageItems.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{item.label}</p>
                    <p className="truncate text-sm font-semibold text-brand-navy">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {isolationIsEstablished ? (
          <div className="mt-3">
            <button
              type="button"
              aria-label="Open embedded isolation workflow"
              onClick={() => onOpenIsolationWorkflow("isolation-needs-reassessment")}
              className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/30"
            >
              Review isolation
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              aria-label="Open embedded isolation workflow"
              onClick={() => onOpenIsolationWorkflow()}
              className="rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20"
            >
              Open isolation workflow
            </button>
          </div>
        )}
        <IsolationEventForm
          tooth={caseData.tooth}
          latestEvent={latestIsolationEvent}
          isolationIsEstablished={isolationIsEstablished}
          userCatalogItems={userIsolationCatalogItems}
          onSaveCatalogItems={onUserIsolationCatalogItemsChange ? (items) => onUserIsolationCatalogItemsChange(updateUserCatalogItems(userIsolationCatalogItems, items)) : undefined}
          onManageShortcuts={onUserIsolationCatalogItemsChange ? () => setActiveCatalogPanel("isolation") : undefined}
          onRecordEvent={onRecordIsolationEvent}
        />
      </section>

      {activeCatalogPanel === "anesthesia" && onUserAnesthesiaCatalogItemsChange ? (
        <FloatingCatalogCard
          title="Anesthesia catalog"
          description="Manage anesthesia suggestion shortcuts without lengthening the shared readiness section."
          onClose={() => setActiveCatalogPanel(null)}
        >
          <AnesthesiaCatalogManager userCatalogItems={userAnesthesiaCatalogItems} onChange={onUserAnesthesiaCatalogItemsChange} />
        </FloatingCatalogCard>
      ) : null}

      {activeCatalogPanel === "isolation" && onUserIsolationCatalogItemsChange ? (
        <FloatingCatalogCard
          title="Isolation catalog"
          description="Manage isolation suggestion shortcuts without lengthening the shared readiness section."
          onClose={() => setActiveCatalogPanel(null)}
        >
          <IsolationCatalogManager userCatalogItems={userIsolationCatalogItems} onChange={onUserIsolationCatalogItemsChange} />
        </FloatingCatalogCard>
      ) : null}
    </div>
  );
}
