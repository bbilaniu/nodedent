import React, { useState } from "react";
import type { CatalogItem } from "../workflow/catalogs";
import { getCatalogItems } from "../workflow/catalogs";
import type { IsolationCatalogField } from "../workflow/isolationCatalog";
import { createUserIsolationCatalogItem, createUserIsolationCatalogOverride, getIsolationCatalogItems, seedIsolationCatalogItems } from "../workflow/isolationCatalog";
import { updateUserCatalogItem } from "../workflow/userCatalogItems";
import { SelectInput, TextInput } from "./FormControls";

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

function isolationCatalogFieldFromLabel(label: string): IsolationCatalogField {
  const entry = Object.entries(isolationCatalogFieldLabels).find(([, fieldLabel]) => fieldLabel === label);
  return (entry?.[0] as IsolationCatalogField | undefined) || "clampCodes";
}

function labelForIsolationCatalogField(field: IsolationCatalogField) {
  return isolationCatalogFieldLabels[field];
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

export function IsolationCatalogManager({
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
