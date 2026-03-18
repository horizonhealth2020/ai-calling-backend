"use client";
import React from "react";
import { colors, spacing, radius, typography } from "../tokens";
import { Button } from "./Button";

export interface DateRangeFilterValue {
  preset: string; // "7d" | "30d" | "month" | "custom"
  from?: string;  // ISO date string YYYY-MM-DD
  to?: string;    // ISO date string YYYY-MM-DD
}

export interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
}

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  flexWrap: "wrap",
};

const DATE_GROUP: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  marginLeft: spacing[3],
};

const DATE_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: colors.textTertiary,
};

const DATE_INPUT: React.CSSProperties = {
  background: colors.bgSurfaceRaised,
  color: colors.textPrimary,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: radius.md,
  padding: "6px 12px",
  fontSize: 14,
  fontFamily: typography.fontSans,
  outline: "none",
};

const presets = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div style={ROW}>
      {presets.map((p) => (
        <Button
          key={p.key}
          variant={value.preset === p.key ? "primary" : "ghost"}
          size="sm"
          onClick={() => {
            if (p.key === "custom") {
              onChange({ preset: "custom", from: value.from || "", to: value.to || "" });
            } else {
              onChange({ preset: p.key });
            }
          }}
        >
          {p.label}
        </Button>
      ))}
      {value.preset === "custom" && (
        <div style={DATE_GROUP}>
          <span style={DATE_LABEL}>From</span>
          <input
            type="date"
            value={value.from || ""}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            style={DATE_INPUT}
          />
          <span style={DATE_LABEL}>To</span>
          <input
            type="date"
            value={value.to || ""}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            style={DATE_INPUT}
          />
        </div>
      )}
    </div>
  );
}
