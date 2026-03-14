"use client";
import { RefreshCw, Zap } from "lucide-react";
import { colors, spacing, radius, shadows } from "@ops/ui";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.bgRoot,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: spacing[8],
      }}
    >
      {/* Top gradient accent */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: colors.accentGradient,
        }}
      />

      <div
        className="animate-scale-in"
        style={{
          textAlign: "center",
          maxWidth: 460,
          width: "100%",
          padding: `${spacing[12]}px ${spacing[8]}px`,
          background: colors.bgSurface,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: radius["2xl"],
          boxShadow: shadows.xl,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: colors.dangerBg,
            border: `1px solid rgba(248,113,113,0.2)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: `0 auto ${spacing[6]}px`,
            color: colors.danger,
          }}
        >
          <Zap size={28} strokeWidth={1.5} />
        </div>

        {/* Error code */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1,
            background: "linear-gradient(135deg, #f87171, #ef4444)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: spacing[4],
            letterSpacing: "-0.03em",
          }}
        >
          500
        </div>

        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.textPrimary,
            margin: `0 0 ${spacing[3]}px`,
            letterSpacing: "-0.01em",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            margin: `0 0 ${spacing[8]}px`,
            lineHeight: 1.6,
          }}
        >
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        <button
          onClick={reset}
          className="btn-hover"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing[2],
            padding: `${spacing[3]}px ${spacing[6]}px`,
            background: "linear-gradient(135deg, #14b8a6, #0d9488)",
            color: "#ffffff",
            border: "none",
            borderRadius: radius.lg,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: shadows.glowPrimary,
          }}
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    </main>
  );
}
