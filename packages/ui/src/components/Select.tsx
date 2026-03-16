"use client";

import React from "react";
import { colors, radius, baseInputStyle, baseLabelStyle } from "../tokens";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Select({
  label,
  error,
  icon,
  style,
  className,
  id,
  children,
  ...rest
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  const selectStyle: React.CSSProperties = {
    ...baseInputStyle,
    appearance: "none",
    borderColor: error ? colors.danger : undefined,
    paddingLeft: icon ? 38 : undefined,
    paddingRight: 36,
    boxSizing: "border-box",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    cursor: "pointer",
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
        <label htmlFor={selectId} style={baseLabelStyle}>
          {label}
        </label>
      )}
      <div style={fieldWrapStyle}>
        {icon && <span style={iconWrapStyle}>{icon}</span>}
        <select
          id={selectId}
          className={["input-focus", className].filter(Boolean).join(" ")}
          style={selectStyle}
          {...rest}
        >
          {children}
        </select>
      </div>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}
