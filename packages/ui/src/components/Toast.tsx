"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { colors, radius, shadows } from "../tokens";

/* ── Types ─────────────────────────────────────────────────────── */

interface ToastItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (type: ToastItem["type"], message: string, duration?: number) => void;
}

/* ── Context ───────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ── Icons ─────────────────────────────────────────────────────── */

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const TYPE_CONFIG: Record<
  ToastItem["type"],
  { icon: React.ReactNode; color: string }
> = {
  success: { icon: <CheckCircleIcon />, color: colors.success },
  error: { icon: <XCircleIcon />, color: colors.danger },
  warning: { icon: <AlertTriangleIcon />, color: colors.warning },
  info: { icon: <InfoIcon />, color: colors.info },
};

/* ── Single Toast ──────────────────────────────────────────────── */

function ToastEntry({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDismiss(item.id);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [item.id, item.duration, onDismiss]);

  const cfg = TYPE_CONFIG[item.type];

  const toastStyle: React.CSSProperties = {
    background: colors.bgSurfaceOverlay,
    border: `1px solid ${colors.borderDefault}`,
    borderLeft: `3px solid ${cfg.color}`,
    borderRadius: radius.lg,
    boxShadow: shadows.lg,
    padding: "12px 16px",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    minWidth: 280,
    maxWidth: 380,
    position: "relative",
    overflow: "hidden",
  };

  const iconStyle: React.CSSProperties = {
    color: cfg.color,
    flexShrink: 0,
    marginTop: 1,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: "1.5",
    flex: 1,
  };

  const closeStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: colors.textTertiary,
    padding: 2,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  };

  const progressBarStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    width: `${progress}%`,
    background: cfg.color,
    opacity: 0.6,
    transition: "width 100ms linear",
  };

  return (
    <div className="animate-slide-in-right" style={toastStyle}>
      <span style={iconStyle}>{cfg.icon}</span>
      <span style={messageStyle}>{item.message}</span>
      <button style={closeStyle} onClick={() => onDismiss(item.id)} aria-label="Dismiss">
        <CloseIcon />
      </button>
      <div style={progressBarStyle} />
    </div>
  );
}

/* ── Provider ──────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastItem["type"], message: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: 16,
    right: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    zIndex: 9999,
    pointerEvents: "none",
  };

  const itemWrapStyle: React.CSSProperties = {
    pointerEvents: "auto",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={containerStyle} aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} style={itemWrapStyle}>
            <ToastEntry item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
