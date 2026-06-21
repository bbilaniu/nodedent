import React, { useState } from "react";
import type { AnesthesiaCatalogField } from "../workflow/anesthesiaCatalog";
import { createUserAnesthesiaCatalogItem, createUserAnesthesiaCatalogOverride, getAnesthesiaCatalogItems, seedAnesthesiaCatalogItems } from "../workflow/anesthesiaCatalog";
import { anesthesiaRouteFromLabel, anesthesiaRouteLabels, anesthesiaRouteOptions } from "../workflow/anesthesiaForm";
import type { CatalogItem } from "../workflow/catalogs";
import { getCatalogItems } from "../workflow/catalogs";
import { updateUserCatalogItem } from "../workflow/userCatalogItems";
import { SelectInput, TextInput } from "./FormControls";

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

function anesthesiaCatalogFieldFromLabel(label: string): AnesthesiaCatalogField {
  const entry = Object.entries(anesthesiaCatalogFieldLabels).find(([, fieldLabel]) => fieldLabel === label);
  return (entry?.[0] as AnesthesiaCatalogField | undefined) || "agents";
}

function labelForAnesthesiaCatalogField(field: AnesthesiaCatalogField) {
  return anesthesiaCatalogFieldLabels[field];
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

export function AnesthesiaCatalogManager({
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
