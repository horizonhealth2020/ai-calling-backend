"use client";

import React, { useRef, useState, useEffect } from "react";
import { colors, radius } from "../tokens";

interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabNavProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function TabNav({ tabs, active, onChange }: TabNavProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[active];
    if (el) {
      const parent = el.parentElement;
      const parentLeft = parent?.getBoundingClientRect().left ?? 0;
      const rect = el.getBoundingClientRect();
      setIndicator({ left: rect.left - parentLeft, width: rect.width });
    }
  }, [active, tabs]);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    position: "relative",
    borderBottom: `1px solid ${colors.borderDefault}`,
    gap: 0,
  };

  const indicatorStyle: React.CSSProperties = {
    position: "absolute",
    bottom: -1,
    height: 2,
    background: colors.primary500,
    borderRadius: `${radius.sm}px ${radius.sm}px 0 0`,
    left: indicator.left,
    width: indicator.width,
    transition: "left 200ms cubic-bezier(0.16, 1, 0.3, 1), width 200ms cubic-bezier(0.16, 1, 0.3, 1)",
    pointerEvents: "none",
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    borderRadius: 9999,
    background: colors.primary500,
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    padding: "0 5px",
  };

  return (
    <div style={containerStyle}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const btnStyle: React.CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: isActive ? colors.textPrimary : colors.textTertiary,
          fontSize: 13,
          fontWeight: isActive ? 600 : 500,
          transition: "color 150ms cubic-bezier(0.16, 1, 0.3, 1)",
          whiteSpace: "nowrap",
          position: "relative",
        };

        return (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[tab.key] = el; }}
            style={btnStyle}
            onClick={() => onChange(tab.key)}
            aria-selected={isActive}
            role="tab"
          >
            {tab.icon && tab.icon}
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span style={badgeStyle}>{tab.badge}</span>
            )}
          </button>
        );
      })}
      <div style={indicatorStyle} />
    </div>
  );
}
