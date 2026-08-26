import React, { useId } from "react";
import { formControlActionButton } from "./uiStyles";

export function FilePickerControl({
  accept,
  buttonLabel,
  describedBy,
  fileName,
  id,
  invalid = false,
  label,
  onFileSelect,
}: {
  accept: string;
  buttonLabel: string;
  describedBy?: string;
  fileName?: string;
  id?: string;
  invalid?: boolean;
  label: string;
  onFileSelect: (file?: File) => void;
}) {
  const generatedId = useId();
  const inputId = id || `file-picker-${generatedId}`;
  const labelId = `${inputId}-label`;
  const fileNameId = `${inputId}-name`;

  return (
    <div className="min-w-0">
      <span id={labelId} className="mb-1 block text-sm font-semibold text-brand-navy">{label}</span>
      <input
        id={inputId}
        type="file"
        accept={accept}
        aria-labelledby={labelId}
        aria-describedby={[describedBy, fileNameId].filter(Boolean).join(" ")}
        aria-invalid={invalid || undefined}
        onChange={(event) => onFileSelect(event.target.files?.[0])}
        className="peer sr-only"
      />
      <div className="flex min-w-0 flex-col items-start gap-2 peer-focus-visible:rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-blue sm:flex-row sm:items-center">
        <label
          htmlFor={inputId}
          className={`${formControlActionButton} cursor-pointer`}
        >
          {buttonLabel}
        </label>
        <span id={fileNameId} className="min-w-0 break-all text-sm font-normal leading-5 text-brand-slate">
          {fileName || "No file selected"}
        </span>
      </div>
    </div>
  );
}
