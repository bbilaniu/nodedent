import React, { useEffect, useId, useState } from "react";
import { semanticFormControl } from "./uiStyles";

export function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  invalid = false,
  inputMode,
  type = "text",
  helperText,
  rightLabel,
  suggestions = [],
}: {
  id?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: React.HTMLInputTypeAttribute;
  helperText?: React.ReactNode;
  rightLabel?: React.ReactNode;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState(value ?? "");
  const generatedInputId = useId();
  const inputId = id || generatedInputId;
  const suggestionListId = `${inputId}-suggestions`;
  const helperId = `${inputId}-helper`;
  const hasSuggestions = suggestions.length > 0;

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 flex min-h-5 items-center justify-between gap-2 text-xs font-medium text-brand-slate">
        <span>{label}</span>
        {rightLabel ? <span className="shrink-0 text-[11px] font-semibold text-brand-navy">{rightLabel}</span> : null}
      </span>
      <input
        id={inputId}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
        list={hasSuggestions ? suggestionListId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={helperText ? helperId : undefined}
        className={invalid ? semanticFormControl.invalid : semanticFormControl.default}
      />
      {hasSuggestions ? (
        <datalist id={suggestionListId}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      ) : null}
      {helperText ? <span id={helperId} className="mt-1 block text-xs leading-5 text-brand-slate">{helperText}</span> : null}
    </label>
  );
}

export function SelectInput({
  id,
  label,
  value,
  onChange,
  options,
  invalid = false,
  helperText,
}: {
  id?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  invalid?: boolean;
  helperText?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const generatedInputId = useId();
  const inputId = id || generatedInputId;
  const helperId = `${inputId}-helper`;

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brand-slate">{label}</span>
      <select
        id={inputId}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={helperText ? helperId : undefined}
        className={invalid ? semanticFormControl.invalid : semanticFormControl.default}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {helperText ? <span id={helperId} className="mt-1 block text-xs leading-5 text-brand-slate">{helperText}</span> : null}
    </label>
  );
}

export function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-brand-navy">{title}</h3>
      {children}
    </section>
  );
}
