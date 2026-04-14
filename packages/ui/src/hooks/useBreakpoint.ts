"use client";

/**
 * Breakpoint-detection hooks for responsive JSX branching.
 *
 * ⚠️ HYDRATION-SAFE USAGE
 *
 * These hooks are SSR-safe (no `window` access at module level), but they
 * return a deterministic default on first render (server-rendered HTML +
 * client first paint) so React hydration produces identical markup.
 *
 * The initial state is ALWAYS:
 *   breakpoint: "desktop", isMobile: false, mounted: false
 *
 * Consumers MUST gate viewport-dependent JSX on `mounted === true`,
 * otherwise mobile users will see the desktop branch flash then re-render
 * as the mobile branch AND React will throw a hydration-mismatch warning.
 *
 * @example
 * ```tsx
 * const { isMobile, mounted } = useIsMobile();
 * // Until mounted, render the SSR/desktop branch — this keeps first paint
 * // identical on server and client. After mount, switch based on viewport.
 * if (!mounted || !isMobile) return <DesktopNav />;
 * return <MobileNav />;
 * ```
 *
 * Values stay in lock-step with `breakpoints` / `mediaQuery` in tokens.ts
 * and the @media rules in responsive.css.
 */

import { useEffect, useState } from "react";
import { mediaQuery } from "../tokens";

export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide";

function readBreakpoint(): Breakpoint {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  if (window.matchMedia(mediaQuery.wide).matches) return "wide";
  if (window.matchMedia(mediaQuery.desktop).matches) return "desktop";
  if (window.matchMedia(mediaQuery.tablet).matches) return "tablet";
  return "mobile";
}

/**
 * Listen to a list of media queries; invoke `onChange` when any of them
 * fires. Returns an unsubscribe function. Handles Safari < 14 via the
 * deprecated addListener/removeListener API.
 */
function subscribeMediaQueries(queries: string[], onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mqls = queries.map((q) => window.matchMedia(q));
  const handler = () => onChange();
  mqls.forEach((mql) => {
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
    } else if (typeof (mql as MediaQueryList & { addListener?: (h: () => void) => void }).addListener === "function") {
      // Safari < 14 fallback
      (mql as MediaQueryList & { addListener: (h: () => void) => void }).addListener(handler);
    }
  });
  return () => {
    mqls.forEach((mql) => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handler);
      } else if (typeof (mql as MediaQueryList & { removeListener?: (h: () => void) => void }).removeListener === "function") {
        (mql as MediaQueryList & { removeListener: (h: () => void) => void }).removeListener(handler);
      }
    });
  };
}

/**
 * Returns the current breakpoint AND a `mounted` flag indicating whether
 * the hook has hydrated. Consumers MUST gate viewport-dependent JSX on
 * `mounted === true` to avoid hydration mismatches.
 */
export function useBreakpoint(): { breakpoint: Breakpoint; mounted: boolean } {
  const [state, setState] = useState<{ breakpoint: Breakpoint; mounted: boolean }>({
    breakpoint: "desktop",
    mounted: false,
  });

  useEffect(() => {
    // First mount: read the real breakpoint and flip `mounted` in one update.
    setState({ breakpoint: readBreakpoint(), mounted: true });
    const unsub = subscribeMediaQueries(
      [mediaQuery.mobile, mediaQuery.tablet, mediaQuery.desktop, mediaQuery.wide],
      () => setState({ breakpoint: readBreakpoint(), mounted: true }),
    );
    return unsub;
  }, []);

  return state;
}

/**
 * Thin wrapper around `useBreakpoint` returning `{ isMobile, mounted }`.
 * See `useBreakpoint` docs for the required hydration-safe usage pattern.
 */
export function useIsMobile(): { isMobile: boolean; mounted: boolean } {
  const { breakpoint, mounted } = useBreakpoint();
  return { isMobile: breakpoint === "mobile", mounted };
}

/**
 * Returns `false` on server + first client render, `true` after mount.
 * Useful for any client-only branching, not just viewport-based.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
