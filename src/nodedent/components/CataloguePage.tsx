import React, { useMemo, useState } from "react";
import type { CatalogItem } from "../workflow/catalogs";
import {
  catalogueDefinitions,
  createUserCatalogueItem,
  getCatalogueDefinitionItems,
  type CatalogueDefinition,
  type CatalogueSection,
} from "../workflow/catalogueDefinitions";
import { updateUserCatalogItem, updateUserCatalogItems } from "../workflow/userCatalogItems";
import { CatalogAdministrationPanel } from "./CatalogAdministrationPanel";
import { SelectInput, TextInput } from "./FormControls";
import {
  cx,
  semanticActionButton,
  semanticChoiceControl,
  semanticStatusSurface,
  statusBadge,
  type StatusRole,
} from "./uiStyles";

const sections: CatalogueSection[] = ["Shared modules", "Endodontics"];

function CatalogueDefinitionManager({
  definition,
  items,
  onChange,
  onStatus,
}: {
  definition: CatalogueDefinition;
  items: CatalogItem[];
  onChange: (items: CatalogItem[]) => boolean;
  onStatus: (message: string, role?: StatusRole) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingLabel, setEditingLabel] = useState("");
  const rows = getCatalogueDefinitionItems(definition, items);

  function commit(nextItems: CatalogItem[], message: string) {
    if (onChange(nextItems)) onStatus(message, "positive");
  }

  function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    const item = createUserCatalogueItem(definition, label);
    if (items.some((candidate) => candidate.id === item.id)) {
      onStatus("That catalogue item already exists.", "attention");
      return;
    }
    commit(updateUserCatalogItem(items, item), `Added “${label}”.`);
    setNewLabel("");
  }

  function saveEdit(item: CatalogItem) {
    const label = editingLabel.trim();
    if (!label) return;
    commit(updateUserCatalogItem(items, { ...item, label }), `Updated “${label}”.`);
    setEditingId("");
    setEditingLabel("");
  }

  function updatePreference(item: CatalogItem, updates: Partial<Pick<CatalogItem, "active" | "favorite" | "sortOrder">>, message: string) {
    commit(updateUserCatalogItem(items, { ...item, ...updates, owner: "user" }), message);
  }

  function removeUserItem(item: CatalogItem, reset: boolean) {
    commit(items.filter((candidate) => candidate.id !== item.id), reset ? `Reset “${item.label}” to its supplied defaults.` : `Deleted “${item.label}”.`);
    if (editingId === item.id) {
      setEditingId("");
      setEditingLabel("");
    }
  }

  function moveItem(item: CatalogItem, direction: -1 | 1) {
    const preferenceGroup = rows.filter((candidate) => Boolean(candidate.favorite) === Boolean(item.favorite));
    const index = preferenceGroup.findIndex((candidate) => candidate.id === item.id);
    const target = preferenceGroup[index + direction];
    if (!target) return;
    const ordered = preferenceGroup.map((candidate, rowIndex) => ({
      ...candidate,
      owner: "user" as const,
      sortOrder: rowIndex * 10,
    }));
    const currentOrder = ordered[index].sortOrder;
    ordered[index].sortOrder = ordered[index + direction].sortOrder;
    ordered[index + direction].sortOrder = currentOrder;
    commit(updateUserCatalogItems(items, ordered), `Moved “${item.label}” ${direction < 0 ? "up" : "down"}.`);
  }

  return (
    <section aria-labelledby={`${definition.key}-heading`} className="rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${definition.key}-heading`} className="text-lg font-bold text-brand-navy">{definition.title}</h3>
          <span className={cx(statusBadge.base, statusBadge.neutral)}>{rows.length} item{rows.length === 1 ? "" : "s"}</span>
        </div>
        <p className="mt-1 text-sm leading-6 text-brand-slate">{definition.description}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <TextInput label={`Add ${definition.title.toLowerCase()} item`} value={newLabel} onChange={setNewLabel} placeholder="Enter custom text" />
        <button type="button" onClick={addItem} disabled={!newLabel.trim()} className={semanticActionButton.primary}>
          Add item
        </button>
      </div>

      <ul aria-label={`${definition.title} catalogue items`} className="mt-4 grid gap-2">
        {rows.map((item) => {
          const suppliedItem = definition.seedItems.some((candidate) => candidate.id === item.id);
          const userOwnedItem = item.owner === "user" && !suppliedItem;
          const editing = editingId === item.id;
          const ownerLabel = suppliedItem ? (item.owner === "user" ? "Supplied item · locally changed" : "Supplied item") : "Local item";
          const preferenceGroup = rows.filter((candidate) => Boolean(candidate.favorite) === Boolean(item.favorite));
          const preferenceIndex = preferenceGroup.findIndex((candidate) => candidate.id === item.id);
          return (
            <li key={item.id} className={`rounded-xl border p-3 ${item.active === false ? "border-brand-light-node bg-brand-light-slate" : "border-brand-light-node bg-white"}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <TextInput label="Edit item" value={editingLabel} onChange={setEditingLabel} />
                  ) : (
                    <p className="break-words text-sm font-semibold text-brand-navy">{item.label}</p>
                  )}
                  <p className="mt-1 text-xs text-brand-slate">{ownerLabel}{item.favorite ? " · Favorite" : ""}{item.active === false ? " · Hidden" : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <button type="button" onClick={() => saveEdit(item)} className={semanticActionButton.primaryCompact}>Save edit</button>
                      <button type="button" onClick={() => { setEditingId(""); setEditingLabel(""); }} className={semanticActionButton.secondaryCompact}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={preferenceIndex === 0} onClick={() => moveItem(item, -1)} className={semanticActionButton.secondaryCompact} aria-label={`Move ${item.label} up`}>↑</button>
                      <button type="button" disabled={preferenceIndex === preferenceGroup.length - 1} onClick={() => moveItem(item, 1)} className={semanticActionButton.secondaryCompact} aria-label={`Move ${item.label} down`}>↓</button>
                      <button type="button" onClick={() => updatePreference(item, { active: item.active !== false, favorite: !item.favorite }, `${item.favorite ? "Removed" : "Added"} favorite for “${item.label}”.`)} className={semanticActionButton.secondaryCompact}>{item.favorite ? "Unfavorite" : "Favorite"}</button>
                      <button type="button" onClick={() => updatePreference(item, { active: item.active === false, favorite: item.favorite }, `${item.active === false ? "Shown" : "Hidden"} “${item.label}”.`)} className={semanticActionButton.secondaryCompact}>{item.active === false ? "Show" : "Hide"}</button>
                      {userOwnedItem ? (
                        <>
                          <button type="button" onClick={() => { setEditingId(item.id); setEditingLabel(item.label); }} className={semanticActionButton.secondaryCompact}>Edit</button>
                          <button type="button" onClick={() => removeUserItem(item, false)} className={semanticActionButton.destructiveCompact}>Delete</button>
                        </>
                      ) : suppliedItem && item.owner === "user" ? (
                        <button type="button" onClick={() => removeUserItem(item, true)} className={semanticActionButton.secondaryCompact}>Reset</button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {!rows.length ? <li className={cx(semanticStatusSurface.neutral, "rounded-xl p-3 text-sm")}>No items in this catalogue.</li> : null}
      </ul>
    </section>
  );
}

export function CataloguePage({
  items,
  onChange,
  onClose,
}: {
  items: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<CatalogueSection>("Shared modules");
  const sectionDefinitions = useMemo(() => catalogueDefinitions.filter((item) => item.section === section), [section]);
  const groups = [...new Set(sectionDefinitions.map((item) => item.group))];
  const [selectedKey, setSelectedKey] = useState(catalogueDefinitions[0].key);
  const selectedDefinition = sectionDefinitions.find((item) => item.key === selectedKey) || sectionDefinitions[0];
  const selectedGroup = selectedDefinition?.group || groups[0];
  const groupDefinitions = sectionDefinitions.filter((item) => item.group === selectedGroup);
  const [status, setStatus] = useState("Catalogue preferences are stored locally and contain no patient data.");
  const [statusRole, setStatusRole] = useState<StatusRole>("neutral");

  function updateStatus(message: string, role: StatusRole = "neutral") {
    setStatus(message);
    setStatusRole(role);
  }

  function selectSection(nextSection: CatalogueSection) {
    setSection(nextSection);
    const first = catalogueDefinitions.find((item) => item.section === nextSection);
    if (first) setSelectedKey(first.key);
  }

  function selectGroup(group: string) {
    const first = sectionDefinitions.find((item) => item.group === group);
    if (first) setSelectedKey(first.key);
  }

  function handleSectionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = sections.length - 1;
    else return;
    event.preventDefault();
    selectSection(sections[nextIndex]);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[nextIndex]?.focus();
  }

  function resetLocalPreferences() {
    if (!window.confirm("Reset all local catalogue additions and overrides? Supplied items will remain available.")) return;
    if (persistItems([])) updateStatus("All local catalogue additions and overrides were reset.", "positive");
  }

  function persistItems(nextItems: CatalogItem[]) {
    try {
      onChange(nextItems);
      return true;
    } catch (cause) {
      updateStatus(cause instanceof Error ? `Catalogue preferences could not be saved: ${cause.message}` : "Catalogue preferences could not be saved. Export a backup or retry after storage access is restored.", "danger");
      return false;
    }
  }

  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-blue">Preferences</p>
              <h1 className="mt-1 text-2xl font-bold">Clinical Catalogue</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-slate">Manage patient-independent suggestions used by clinical forms. These entries help documentation and do not prescribe products, doses, or treatment.</p>
            </div>
            <button type="button" onClick={onClose} className={semanticActionButton.secondary}>Back to workspace</button>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-light-node bg-white p-4">
          <div role="tablist" aria-label="Catalogue sections" className="flex flex-wrap gap-2">
            {sections.map((item, index) => {
              const count = catalogueDefinitions
                .filter((candidate) => candidate.section === item)
                .reduce((total, candidate) => total + getCatalogueDefinitionItems(candidate, items).length, 0);
              const selected = section === item;
              return (
                <button key={item} type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} onKeyDown={(event) => handleSectionKeyDown(event, index)} onClick={() => selectSection(item)} className={selected ? semanticChoiceControl.selected : semanticChoiceControl.unselected}>
                  <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, selected ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
                  {item} ({count})
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectInput label="Catalogue group" value={selectedGroup} onChange={selectGroup} options={groups} />
            <SelectInput label="Catalogue" value={selectedDefinition?.title || ""} onChange={(title) => { const match = groupDefinitions.find((item) => item.title === title); if (match) setSelectedKey(match.key); }} options={groupDefinitions.map((item) => item.title)} />
          </div>
        </section>

        <p role="status" className={cx(semanticStatusSurface[statusRole], "rounded-xl px-4 py-3 text-sm")}>{status}</p>

        {selectedDefinition ? <CatalogueDefinitionManager definition={selectedDefinition} items={items} onChange={persistItems} onStatus={updateStatus} /> : null}

        <CatalogAdministrationPanel items={items} onChange={(nextItems) => { const saved = persistItems(nextItems); if (saved) updateStatus("Imported catalogue preferences were saved locally.", "positive"); return saved; }} />

        <section className={cx(semanticStatusSurface.danger, "p-4")}>
          <h2 className="text-sm font-bold text-red-800">Reset local catalogue preferences</h2>
          <p className="mt-1 text-xs leading-5 text-brand-slate">Removes local additions, favorites, ordering, and hidden-item overrides. Supplied catalogue items remain available.</p>
          <button type="button" onClick={resetLocalPreferences} className={cx(semanticActionButton.destructive, "mt-3")}>Reset local catalogue</button>
        </section>
      </div>
    </main>
  );
}
