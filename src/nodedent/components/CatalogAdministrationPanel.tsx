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
import { ImportDisclosure } from "./ImportDisclosure";
import { cx, semanticActionButton, semanticStatusSurface } from "./uiStyles";

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
  onChange: (items: CatalogItem[]) => void | boolean;
}) {
  const [selectedFilename, setSelectedFilename] = useState("");
  const [catalogExport, setCatalogExport] = useState<UserCatalogExport | null>(null);
  const [preview, setPreview] = useState<UserCatalogImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);

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
    if (onChange(nextItems) === false) {
      setError("Catalogue preferences could not be saved. The current preferences were left unchanged.");
      return;
    }
    setError("");
    setMessage(`Imported ${preview.additions} new catalogue item${preview.additions === 1 ? "" : "s"}. Existing and conflicting item IDs were left unchanged.`);
    setPreview(previewUserCatalogImport(nextItems, catalogExport.state.items));
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
      <h3 className="text-sm font-semibold text-brand-navy">Catalogue preferences</h3>
      <p className="mt-1 text-xs leading-5 text-brand-slate">
        Export or import all patient-independent clinical catalogue preferences. Clinical events and case data are not included.
      </p>
      <ImportDisclosure
        id="catalogue-preferences-import"
        buttonLabel="Import catalogue preferences"
        expanded={isImportOpen}
        onToggle={() => setIsImportOpen((open) => !open)}
        action={(
          <button
            type="button"
            onClick={() => downloadCatalogExport(items)}
            className={semanticActionButton.secondary}
          >
            Download catalogue preferences
          </button>
        )}
      >
        <FilePickerControl
          label="Catalogue export file"
          buttonLabel="Select catalogue export"
          accept=".json,application/json"
          fileName={selectedFilename}
          onFileSelect={(file) => void selectImportFile(file)}
        />
        {preview ? (
          <div className="mt-3 rounded-xl border border-brand-blue-light/60 bg-brand-light-slate p-3">
            <p className="text-sm font-semibold text-brand-navy">Import preview</p>
            <p className="mt-1 text-xs leading-5 text-brand-slate">
              {preview.additions} new · {preview.equivalentItems} already identical · {preview.idConflicts} ID conflict{preview.idConflicts === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs leading-5 text-brand-slate">
              {Object.entries(preview.itemsByCategory).map(([category, count]) => `${count} ${category}`).join(" · ") || "No catalogue items"}
            </p>
            <button
              type="button"
              disabled={!preview.additions}
              onClick={importNewItems}
              className={cx(semanticActionButton.primaryCompact, "mt-2")}
            >
              Import new catalogue items
            </button>
          </div>
        ) : null}
      </ImportDisclosure>
      {error ? <p role="alert" className={cx(semanticStatusSurface.danger, "mt-3 rounded-xl px-3 py-2 text-sm")}>{error}</p> : null}
      {message ? <p role="status" className={cx(semanticStatusSurface.positive, "mt-3 rounded-xl px-3 py-2 text-sm")}>{message}</p> : null}
    </div>
  );
}
