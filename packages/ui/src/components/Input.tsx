"use client";

import React from "react";
import { colors, baseInputStyle, baseLabelStyle } from "../tokens";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  style,
  className,
  id,
  disabled,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  const inputStyle: React.CSSProperties = {
    ...baseInputStyle,
    borderColor: error ? colors.danger : disabled ? colors.borderSubtle : undefined,
    paddingLeft: icon ? 38 : undefined,
    boxSizing: "border-box",
    ...(disabled ? { background: colors.bgRoot, color: colors.textMuted, cursor: "not-allowed" } : {}),
    ...style,
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    display: "block",
  };

  const iconWrapStyle: React.CSSProperties = {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: colors.textTertiary,
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
  };

  const wrapStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  };

  const fieldWrapStyle: React.CSSProperties = {
    position: "relative",
  };

  return (
    <div style={wrapStyle}>
      {label && (
        <label htmlFor={inputId} style={baseLabelStyle}>
          {label}
        </label>
      )}
      <div style={fieldWrapStyle}>
        {icon && <span style={iconWrapStyle}>{icon}</span>}
        <input
          id={inputId}
          className={["input-focus", className].filter(Boolean).join(" ")}
          style={inputStyle}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...rest}
        />
      </div>
      {error && <span id={errorId} style={errorStyle}>{error}</span>}
    </div>
  );
}
