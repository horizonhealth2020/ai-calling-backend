"use client";

import React from "react";
import { colors, radius, baseInputStyle, baseLabelStyle } from "../tokens";

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
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  const inputStyle: React.CSSProperties = {
    ...baseInputStyle,
    borderColor: error ? colors.danger : undefined,
    paddingLeft: icon ? 38 : undefined,
    boxSizing: "border-box",
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
          {...rest}
        />
      </div>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}
