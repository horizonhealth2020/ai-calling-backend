"use client";

import React from "react";
import { colors } from "../tokens";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "48px 24px",
    gap: 12,
  };

  const iconWrapStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.textTertiary,
    marginBottom: 4,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: colors.textSecondary,
    margin: 0,
    maxWidth: 320,
    lineHeight: "1.6",
  };

  return (
    <div className="animate-fade-in" style={containerStyle}>
      {icon && <div style={iconWrapStyle}>{icon}</div>}
      <p style={titleStyle}>{title}</p>
      {description && <p style={descStyle}>{description}</p>}
      {action && (
        <div style={{ marginTop: 4 }}>
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
