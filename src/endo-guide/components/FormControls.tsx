import React, { useEffect, useState } from "react";

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  invalid = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"}`}
      />
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
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
    <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}
