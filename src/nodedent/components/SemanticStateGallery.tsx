import React, { useEffect, useState } from "react";
import { ClinicalDataNotice } from "./ClinicalDataNotice";
import {
  cx,
  headerActionButton,
  semanticActionButton,
  semanticChoiceControl,
  semanticChoiceSurfaceControl,
  semanticDialogSurface,
  semanticFormControl,
  semanticInteraction,
  semanticSelectionSurface,
  semanticSelectionTone,
  semanticReadOnlyOutput,
  semanticStatusSurface,
  semanticStatusTone,
  statusBadge,
} from "./uiStyles";

type GalleryTheme = "light" | "dark";

function getInitialGalleryTheme(): GalleryTheme {
  if (typeof window === "undefined") return "light";
  const value = new URLSearchParams(window.location.search).get("theme");
  return value === "dark" ? "dark" : "light";
}

function ChoiceExample({
  selected,
  disabled = false,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={selected ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
    >
      <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, selected ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
      {children}
    </button>
  );
}

function StateCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-brand-light-node bg-brand-light-slate p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-slate">{label}</p>
      {children}
    </div>
  );
}

export function SemanticStateGallery() {
  const [theme, setTheme] = useState<GalleryTheme>(getInitialGalleryTheme);

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = theme;
    return () => {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  return (
    <main data-testid="semantic-state-gallery" className="min-h-screen bg-brand-light-slate p-4 text-brand-navy sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Development-only fixture</p>
              <h1 className="mt-1 text-2xl font-bold">Semantic UI state gallery</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-slate">
                Stable examples for action prominence, selected controls, clinical status, focus, disabled, and loading treatments. This route contains synthetic UI states only.
              </p>
            </div>
            <div role="group" aria-label="Gallery theme" className="flex gap-2">
              <ChoiceExample selected={theme === "light"} onClick={() => setTheme("light")}>Light</ChoiceExample>
              <button
                type="button"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
                className={theme === "dark" ? semanticChoiceControl.selected : semanticChoiceControl.unselected}
              >
                <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, theme === "dark" ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
                Dark
              </button>
            </div>
          </div>
        </header>

        <section aria-labelledby="gallery-chrome-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-chrome-heading" className="text-lg font-bold">Application chrome and notices</h2>
          <p className="mt-1 text-sm text-brand-slate">Header actions retain action hierarchy while vault, deployment, privacy, and error messages use non-interactive status surfaces.</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex min-h-9 items-center rounded-full border border-brand-light-node bg-white px-3 font-semibold text-brand-slate">Chart: SYN-001</span>
                  <span role="status" className={cx("inline-flex min-h-9 items-center", statusBadge.base, semanticStatusTone.positive)}>Vault: saved</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={headerActionButton.primary}>Case Setup &amp; Status</button>
                  <button type="button" className={headerActionButton.secondary}>Catalogue</button>
                </div>
              </div>
            </div>
            <ClinicalDataNotice compact />
            <div role="alert" className={cx(semanticStatusSurface.danger, "flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between")}>
              <p><strong>Protected autosave needs attention.</strong> Review the protected record before continuing.</p>
              <button type="button" className={semanticActionButton.warning}>Export current JSON</button>
            </div>
          </div>
        </section>

        <section aria-labelledby="gallery-action-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-action-heading" className="text-lg font-bold">Action roles and interaction states</h2>
          <p className="mt-1 text-sm text-brand-slate">Action appearance describes prominence or consequence, never workflow category or selection.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StateCell label="Primary"><button type="button" className={semanticActionButton.primary}>Record entry</button></StateCell>
            <StateCell label="Secondary"><button type="button" className={semanticActionButton.secondary}>Manage catalogue</button></StateCell>
            <StateCell label="Warning"><button type="button" className={semanticActionButton.warning}>Continue with caution</button></StateCell>
            <StateCell label="Destructive"><button type="button" className={semanticActionButton.destructive}>Delete entry</button></StateCell>
            <StateCell label="Focus visible">
              <button type="button" className={cx(semanticActionButton.secondary, "outline-2 outline-solid outline-offset-2 outline-brand-blue")}>Keyboard focus</button>
            </StateCell>
            <StateCell label="Disabled">
              <button type="button" disabled aria-describedby="gallery-disabled-reason" className={semanticActionButton.primary}>Record entry</button>
              <p id="gallery-disabled-reason" className="mt-2 text-xs leading-5 text-brand-slate">Complete the required fields first.</p>
            </StateCell>
            <StateCell label="Loading">
              <button type="button" aria-busy="true" aria-disabled="true" className={cx(semanticActionButton.primary, semanticInteraction.loading)}>
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Recording…
              </button>
            </StateCell>
            <StateCell label="Large primary"><button type="button" className={semanticActionButton.primaryLarge}>Start workflow</button></StateCell>
          </div>
        </section>

        <section aria-labelledby="gallery-choice-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-choice-heading" className="text-lg font-bold">Choice controls</h2>
          <p className="mt-1 text-sm text-brand-slate">Selection uses a tinted surface, strong border, programmatic state, and a visible check—not a primary-action fill or mint status color.</p>
          <div role="group" aria-label="Synthetic choice examples" className="mt-4 flex flex-wrap gap-3">
            <ChoiceExample selected>Selected choice</ChoiceExample>
            <ChoiceExample selected={false}>Unselected choice</ChoiceExample>
            <ChoiceExample selected={false} disabled>Unavailable choice</ChoiceExample>
          </div>
        </section>

        <section aria-labelledby="gallery-setup-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-setup-heading" className="text-lg font-bold">Setup selection and form controls</h2>
          <p className="mt-1 text-sm text-brand-slate">A selected workflow uses selection styling, its principal launcher remains primary, and form focus stays blue.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className={semanticSelectionSurface.selected}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Selected workflow</p>
                  <h3 className="mt-1 font-bold">Example treatment</h3>
                </div>
                <span className={cx(statusBadge.base, semanticSelectionTone.selected)}>Selected</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={semanticActionButton.primary}>Open workflow</button>
                <button type="button" aria-pressed="true" className={semanticActionButton.secondary}>Remove from case</button>
              </div>
            </article>
            <div className="grid gap-3 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-brand-slate">Default field</span>
                <input aria-label="Default field" readOnly value="Synthetic value" className={semanticFormControl.default} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-brand-slate">Invalid field</span>
                <input aria-label="Invalid field" aria-invalid="true" readOnly value="Review value" className={semanticFormControl.invalid} />
              </label>
            </div>
          </div>
        </section>

        <section aria-labelledby="gallery-dense-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-dense-heading" className="text-lg font-bold">Targets, history, and output</h2>
          <p className="mt-1 text-sm text-brand-slate">Dense clinical surfaces keep target selection, recorded status, historical rows, output formats, and plaintext actions semantically independent.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <article>
              <h3 className="text-sm font-semibold">Target selection</h3>
              <button type="button" aria-pressed="true" className={cx(semanticChoiceSurfaceControl.selected, "mt-2")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, semanticChoiceControl.indicatorSelected)}>✓</span>
                    <strong>Main canal</strong>
                  </span>
                  <span className={cx(statusBadge.base, semanticStatusTone.positive)}>Shaped</span>
                </span>
                <span className="mt-2 block text-xs text-brand-slate">WL 21 mm · Shape 25/.04</span>
              </button>
            </article>
            <article>
              <h3 className="text-sm font-semibold">Recent history</h3>
              <ol className="mt-2 space-y-2">
                <li className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3 text-xs">
                  <div className="flex justify-between gap-2"><strong>workingLength.established</strong><time dateTime="2026-08-25T12:00:00.000Z" className="text-brand-slate">12:00</time></div>
                  <p className="mt-1 text-brand-slate">Main canal working length recorded.</p>
                </li>
                <li className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3 text-xs">
                  <div className="flex justify-between gap-2"><strong>shaping.completed</strong><time dateTime="2026-08-25T12:08:00.000Z" className="text-brand-slate">12:08</time></div>
                  <p className="mt-1 text-brand-slate">Main canal shaping recorded.</p>
                </li>
              </ol>
            </article>
            <article>
              <h3 className="text-sm font-semibold">Output</h3>
              <div role="tablist" aria-label="Synthetic output format" className="mt-2 flex flex-wrap gap-2">
                <button type="button" role="tab" aria-selected="true" className={semanticChoiceControl.selected}><span aria-hidden="true" className={cx(semanticChoiceControl.indicator, semanticChoiceControl.indicatorSelected)}>✓</span>Compact</button>
                <button type="button" role="tab" aria-selected="false" className={semanticChoiceControl.unselected}><span aria-hidden="true" className={cx(semanticChoiceControl.indicator, semanticChoiceControl.indicatorUnselected)}>✓</span>Full</button>
              </div>
              <textarea aria-label="Synthetic read-only output" readOnly value="Synthetic clinical output" className={cx(semanticReadOnlyOutput, "mt-2 h-24")} />
              <div className="mt-2 grid gap-2">
                <button type="button" className={semanticActionButton.warning}>Download plaintext</button>
                <button type="button" className={semanticActionButton.warning}>Copy output</button>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="gallery-launcher-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-launcher-heading" className="text-lg font-bold">Equivalent launcher actions</h2>
          <p className="mt-1 text-sm text-brand-slate">Headings and descriptions retain category; both principal launch actions share one interaction contract.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Primary workflow</p>
              <h3 className="mt-1 font-bold">Example workflow</h3>
              <p className="mt-1 text-sm text-brand-slate">Synthetic primary-workflow description.</p>
              <button type="button" className={cx(semanticActionButton.primary, "mt-4")}>Start workflow</button>
            </article>
            <article className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Shared module</p>
              <h3 className="mt-1 font-bold">Example shared module</h3>
              <p className="mt-1 text-sm text-brand-slate">Synthetic shared-module description.</p>
              <button type="button" className={cx(semanticActionButton.primary, "mt-4")}>Open module</button>
            </article>
          </div>
        </section>

        <section aria-labelledby="gallery-record-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-record-heading" className="text-lg font-bold">Record action and resulting status</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
            <button type="button" className={semanticActionButton.primaryDecision}>
              <span className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg">+</span>
                <span>
                  <span className="block">Record example entry</span>
                  <span className="mt-1 block text-xs font-normal text-white/80">Next: example status becomes recorded</span>
                </span>
              </span>
            </button>
            <div role="status" className={cx("rounded-2xl border p-4 text-sm", semanticStatusTone.positive)}>
              <strong>Recorded</strong>
              <span className="mt-1 block text-xs">Mint communicates the resulting positive state.</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="gallery-dialog-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-dialog-heading" className="text-lg font-bold">Dialogs and high-consequence decisions</h2>
          <p className="mt-1 text-sm text-brand-slate">A consistent dialog frame keeps dismissal quiet while primary, warning, and destructive decisions communicate prominence and consequence explicitly.</p>
          <div className="mt-4 rounded-3xl bg-brand-navy-deep/10 p-3 sm:p-5">
            <article role="dialog" aria-labelledby="gallery-synthetic-dialog-title" className={cx(semanticDialogSurface.panelCentered, "mx-auto max-w-2xl")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Synthetic dialog</p>
                  <h3 id="gallery-synthetic-dialog-title" className="mt-1 text-xl font-bold">Pause or end this visit</h3>
                  <p className="mt-1 text-sm text-brand-slate">Choose an explicitly labeled action. Clinical state appears after the action is recorded.</p>
                </div>
                <button type="button" className={semanticActionButton.secondary}>Cancel</button>
              </div>
              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-medium text-brand-slate">Next-visit plan</span>
                <textarea readOnly value="Synthetic continuation plan" className={semanticFormControl.default} />
              </label>
              <div className="mt-4 grid gap-3">
                <button type="button" className={semanticActionButton.primaryDecision}>Pause here and continue later</button>
                <button type="button" className={semanticActionButton.warningDecision}>Open a cautionary pathway</button>
                <button type="button" className={semanticActionButton.destructiveDecision}>Delete saved case permanently</button>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="gallery-status-heading" className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm">
          <h2 id="gallery-status-heading" className="text-lg font-bold">Status roles</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className={cx(statusBadge.base, semanticStatusTone.positive)}>Positive · Ready</span>
            <span className={cx(statusBadge.base, semanticStatusTone.attention)}>Attention · Review</span>
            <span className={cx(statusBadge.base, semanticStatusTone.neutral)}>Neutral · Pending</span>
            <span className={cx(statusBadge.base, semanticStatusTone.difficulty)}>Difficulty · High</span>
            <span className={cx(statusBadge.base, semanticStatusTone.danger)}>Danger · Error</span>
          </div>
        </section>
      </div>
    </main>
  );
}
