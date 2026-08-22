import React, { useState } from "react";
import type { CatalogItem } from "../workflow/catalogs";
import {
  buildUserCatalogExport,
  buildUserCatalogExportFilename,
  mergeNewUserCatalogItems,
  parseUserCatalogExport,
  previewUserCatalogImport,
  type UserCatalogExport,
  type UserCatalogImportPreview,
} from "../state/catalogPersistence";
import { FilePickerControl } from "./FilePickerControl";

function downloadCatalogExport(items: CatalogItem[]) {
  const blob = new Blob([JSON.stringify(buildUserCatalogExport(items), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildUserCatalogExportFilename();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function CatalogAdministrationPanel({
  items,
  onChange,
}: {
  items: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
}) {
  const [selectedFilename, setSelectedFilename] = useState("");
  const [catalogExport, setCatalogExport] = useState<UserCatalogExport | null>(null);
  const [preview, setPreview] = useState<UserCatalogImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function selectImportFile(file?: File) {
    setSelectedFilename(file?.name || "");
    setCatalogExport(null);
    setPreview(null);
    setMessage("");
    setError("");
    if (!file) return;
    try {
      const parsed = parseUserCatalogExport(await file.text());
      setCatalogExport(parsed);
      setPreview(previewUserCatalogImport(items, parsed.state.items));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalogue import could not be read.");
    }
  }

  function importNewItems() {
    if (!catalogExport || !preview) return;
    const nextItems = mergeNewUserCatalogItems(items, catalogExport.state.items);
    onChange(nextItems);
    setMessage(`Imported ${preview.additions} new catalogue item${preview.additions === 1 ? "" : "s"}. Existing and conflicting item IDs were left unchanged.`);
    setPreview(previewUserCatalogImport(nextItems, catalogExport.state.items));
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
      <h3 className="text-sm font-semibold text-brand-navy">Catalogue preferences</h3>
      <p className="mt-1 text-xs leading-5 text-brand-slate">
        Export or import patient-independent anesthesia and isolation shortcuts. Clinical events and case data are not included.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => downloadCatalogExport(items)}
          className="rounded-xl border border-brand-mint bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-mint/20"
        >
          Download catalogue preferences
        </button>
        <FilePickerControl
          label="Catalogue export file"
          buttonLabel="Select catalogue export"
          accept=".json,application/json"
          fileName={selectedFilename}
          onFileSelect={(file) => void selectImportFile(file)}
        />
      </div>
      {error ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {preview ? (
        <div className="mt-3 rounded-xl border border-brand-blue-light/60 bg-white p-3">
          <p className="text-sm font-semibold text-brand-navy">Import preview</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">
            {preview.additions} new · {preview.equivalentItems} already identical · {preview.idConflicts} ID conflict{preview.idConflicts === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">
            {preview.itemsByCategory.anesthesia || 0} anesthesia · {preview.itemsByCategory.isolation || 0} isolation
          </p>
          <button
            type="button"
            disabled={!preview.additions}
            onClick={importNewItems}
            className="mt-2 rounded-lg border border-brand-navy bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-brand-light-slate disabled:text-brand-slate"
          >
            Import new catalogue items
          </button>
        </div>
      ) : null}
      {message ? <p role="status" className="mt-3 rounded-xl border border-brand-mint/40 bg-brand-mint/10 px-3 py-2 text-sm text-brand-navy">{message}</p> : null}
    </div>
  );
}
