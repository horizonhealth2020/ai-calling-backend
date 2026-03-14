"use client";

import React from "react";
import { colors, radius, baseButtonStyle } from "../tokens";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const SIZE_STYLES: Record<
  NonNullable<ButtonProps["size"]>,
  React.CSSProperties
> = {
  sm: { padding: "6px 12px", fontSize: 12 },
  md: { padding: "10px 20px", fontSize: 13 },
  lg: { padding: "12px 24px", fontSize: 14 },
};

const VARIANT_STYLES: Record<
  NonNullable<ButtonProps["variant"]>,
  React.CSSProperties
> = {
  primary: {
    background: colors.accentGradient,
    color: "#ffffff",
    border: "none",
  },
  secondary: {
    background: colors.bgSurfaceRaised,
    color: colors.textSecondary,
    border: `1px solid ${colors.borderDefault}`,
  },
  ghost: {
    background: "transparent",
    color: colors.textSecondary,
    border: "none",
  },
  danger: {
    background: colors.danger,
    color: "#ffffff",
    border: "none",
  },
  success: {
    background: "#059669",
    color: "#ffffff",
    border: "none",
  },
};

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  children,
  disabled,
  style,
  className,
  ...rest
}: ButtonProps) {
  const composedStyle: React.CSSProperties = {
    ...baseButtonStyle,
    ...SIZE_STYLES[size],
    ...VARIANT_STYLES[variant],
    borderRadius: radius.md,
    width: fullWidth ? "100%" : undefined,
    opacity: disabled || loading ? 0.6 : 1,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    ...style,
  };

  const resolvedIcon = loading ? <SpinnerIcon /> : icon;

  return (
    <button
      className={["btn-hover", className].filter(Boolean).join(" ")}
      style={composedStyle}
      disabled={disabled || loading}
      {...rest}
    >
      {resolvedIcon && iconPosition === "left" && resolvedIcon}
      {children}
      {resolvedIcon && iconPosition === "right" && resolvedIcon}
    </button>
  );
}
