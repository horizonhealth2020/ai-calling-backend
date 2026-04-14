"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { colors, radius, shadows, spacing, typography, motion } from "../tokens";

/**
 * Accessible mobile drawer / bottom-sheet primitive.
 *
 * - Slides in from the specified side (left | right | bottom)
 * - Backdrop dismissal, ESC dismissal, and explicit × Close button
 * - Traps focus inside while open; restores focus to the opener on close
 * - Body scroll locked on open; prior overflow value restored on close
 * - Respects `prefers-reduced-motion: reduce`
 * - `ariaLabel` is REQUIRED — every dialog must be named
 *
 * Rendered inline (no portal) — z-index 1000 sits above everything in
 * the existing app. Consistent with the ConfirmModal precedent.
 */
export type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Required — every dialog must be named (enforced at type level). */
  ariaLabel: string;
  side?: "left" | "right" | "bottom";
  children: React.ReactNode;
  /** DOM id for `aria-controls` wiring from the opener button. */
  id?: string;
};

const BACKDROP: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 999,
};

function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getFocusableDescendants(root: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

export function MobileDrawer({
  open,
  onClose,
  ariaLabel,
  side = "left",
  children,
  id,
}: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const priorBodyOverflowRef = useRef<string>("");

  // Focus management + ESC + body scroll lock — runs only while open.
  useEffect(() => {
    if (!open) return;

    // Capture prior focus target and body overflow so we can restore later.
    previouslyFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null;
    priorBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move initial focus into the drawer — first focusable, else panel itself.
    const moveFocusIn = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableDescendants(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    };
    // Defer one frame so the DOM is committed before focusing.
    const rafId = window.requestAnimationFrame(moveFocusIn);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = getFocusableDescendants(panel);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      // Restore prior body overflow (not a hardcoded value).
      document.body.style.overflow = priorBodyOverflowRef.current;
      // Restore focus to the opener if it's still present in the DOM.
      const prev = previouslyFocusedRef.current;
      if (prev && document.body.contains(prev) && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const useReducedMotion = reducedMotion();
  const transition = useReducedMotion
    ? "none"
    : `transform ${motion.duration.normal} ${motion.easing.out}`;

  let panelStyle: React.CSSProperties;
  if (side === "bottom") {
    panelStyle = {
      // Use .bottom-sheet-base class for positioning; inline overrides for the rest.
      maxHeight: "85vh",
      overflowY: "auto",
      transform: "translateY(0)",
      transition,
      zIndex: 1000,
    };
  } else {
    const edge = side === "left" ? { left: 0 } : { right: 0 };
    panelStyle = {
      position: "fixed",
      top: 0,
      bottom: 0,
      ...edge,
      width: "85vw",
      maxWidth: 360,
      background: colors.bgSurface,
      borderRight: side === "left" ? `1px solid ${colors.borderDefault}` : undefined,
      borderLeft: side === "right" ? `1px solid ${colors.borderDefault}` : undefined,
      boxShadow: shadows.lg,
      transform: "translateX(0)",
      transition,
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
    };
  }

  const closeBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: colors.textTertiary,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    padding: spacing[1],
  };

  return (
    <>
      <div style={BACKDROP} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        style={panelStyle}
        className={side === "bottom" ? "bottom-sheet-base" : undefined}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="touch-target"
          style={closeBtnStyle}
        >
          <X size={18} />
        </button>
        <div
          style={{
            paddingTop: spacing[8],
            paddingRight: spacing[4],
            paddingBottom: spacing[4],
            paddingLeft: spacing[4],
            fontFamily: typography.fontSans,
            color: colors.textPrimary,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
