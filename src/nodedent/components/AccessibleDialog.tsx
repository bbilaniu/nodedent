import React, { useEffect, useRef } from "react";
import { cx, semanticDialogSurface } from "./uiStyles";

type DialogRole = "dialog" | "alertdialog";
type DialogOverlayVariant = "default" | "raised" | "centered";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const dialogStack: symbol[] = [];
let scrollLockDepth = 0;
let previousBodyOverflow = "";

function focusableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    element.getAttribute("aria-hidden") !== "true"
    && element.getAttribute("aria-disabled") !== "true"
    && !element.closest("[hidden], [aria-hidden='true'], [inert]")
    && element.getClientRects().length > 0
  ));
}

function suppressBackground(overlay: HTMLElement) {
  const parent = overlay.parentElement;
  if (!parent) return () => {};

  const siblings = Array.from(parent.children).filter((element): element is HTMLElement => (
    element instanceof HTMLElement && element !== overlay && !["SCRIPT", "STYLE"].includes(element.tagName)
  ));
  const previous = siblings.map((element) => ({
    element,
    inert: element.inert,
    ariaHidden: element.getAttribute("aria-hidden"),
  }));

  for (const { element } of previous) {
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
  }

  return () => {
    for (const { element, inert, ariaHidden } of previous) {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    }
  };
}

function lockDocumentScroll() {
  if (scrollLockDepth === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockDepth += 1;

  return () => {
    scrollLockDepth = Math.max(0, scrollLockDepth - 1);
    if (scrollLockDepth === 0) document.body.style.overflow = previousBodyOverflow;
  };
}

export function AccessibleDialog({
  labelledBy,
  describedBy,
  role = "dialog",
  overlayVariant = "default",
  panelClassName,
  closeOnBackdrop = false,
  closeOnEscape = true,
  onRequestClose,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  role?: DialogRole;
  overlayVariant?: DialogOverlayVariant;
  panelClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const requestCloseRef = useRef(onRequestClose);
  requestCloseRef.current = onRequestClose;

  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    const dialogPanel = panel;

    const dialogId = Symbol("accessible-dialog");
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogStack.push(dialogId);
    const restoreBackground = suppressBackground(overlay);
    const restoreScroll = lockDocumentScroll();
    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = dialogPanel.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      const first = focusableElements(dialogPanel)[0];
      (preferred || first || dialogPanel).focus({ preventScroll: true });
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (dialogStack.at(-1) !== dialogId) return;
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        requestCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements(dialogPanel);
      if (!focusable.length) {
        event.preventDefault();
        dialogPanel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogPanel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogPanel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      const stackIndex = dialogStack.lastIndexOf(dialogId);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      restoreBackground();
      restoreScroll();
      if (previouslyFocused?.isConnected) {
        window.requestAnimationFrame(() => previouslyFocused.focus({ preventScroll: true }));
      }
    };
  }, [closeOnEscape]);

  const overlayClassName = overlayVariant === "raised"
    ? semanticDialogSurface.overlayRaised
    : overlayVariant === "centered"
      ? semanticDialogSurface.overlayCentered
      : semanticDialogSurface.overlay;
  const defaultPanelClassName = overlayVariant === "centered"
    ? semanticDialogSurface.panelCentered
    : semanticDialogSurface.panel;

  return (
    <div
      ref={overlayRef}
      data-accessible-dialog-overlay="true"
      className={overlayClassName}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) requestCloseRef.current();
      }}
    >
      <section
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cx(defaultPanelClassName, panelClassName)}
      >
        {children}
      </section>
    </div>
  );
}
