import React, { useEffect, useState } from "react";

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  invalid = false,
  inputMode,
  helperText,
  rightLabel,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  helperText?: React.ReactNode;
  rightLabel?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(value ?? "");

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
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-brand-light-node focus:border-brand-mint focus:ring-brand-mint/20"}`}
      />
      {helperText ? <span className="mt-1 block text-xs leading-5 text-brand-slate">{helperText}</span> : null}
    </label>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brand-slate">{label}</span>
      <select
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
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
