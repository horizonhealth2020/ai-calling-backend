import React from "react";
import { colors, spacing, radius, baseInputStyle, baseThStyle, baseTdStyle } from "@ops/ui";

const C = colors;
const S = spacing;
const R = radius;

/* ── Types ──────────────────────────────────────────────────── */

export type SaleAddonInfo = { productId: string; premium: number | null; product: { id: string; name: string; type: string } };
export type SaleInfo = {
  id: string; memberName: string; memberId?: string; carrier: string;
  premium: number; enrollmentFee: number | null; commissionApproved: boolean;
  status: string; notes?: string; memberCount?: number | null;
  acaCoveringSaleId?: string | null; paymentType?: string | null;
  product: { id: string; name: string; type: string; flatCommission?: number | null };
  addons?: SaleAddonInfo[];
};
export type Entry = {
  id: string; payoutAmount: number; adjustmentAmount: number; bonusAmount: number;
  frontedAmount: number; holdAmount: number; netAmount: number; status: string;
  halvingReason?: string | null;
  acaAttached?: {
    memberCount: number;
    flatCommission: number;
    payoutAmount: number;
    productName?: string;
    // Phase 47 Sub-feature 4: surfaced so EditableSaleRow can render an editable
    // ACA covering-child row (with X button) and send the correct IDs back via
    // the PATCH /sales/:id acaChild payload field.
    productId?: string;
    childSaleId?: string;
  } | null;
  sale?: SaleInfo; agent?: { name: string };
};
export type BonusCategory = { name: string; isDeduction: boolean };
export type ServiceEntry = {
  id: string; basePay: number; bonusAmount: number; deductionAmount: number;
  frontedAmount?: number; totalPay: number; bonusBreakdown?: Record<string, number>;
  status: string; notes?: string; serviceAgent: { name: string; basePay: number };
};
export type AgentAdjustment = {
  id: string;
  agentId: string;
  payrollPeriodId: string;
  bonusAmount: string;
  frontedAmount: string;
  holdAmount: string;
  bonusLabel: string | null;
  holdLabel: string | null;
  bonusFromCarryover: boolean;
  holdFromCarryover: boolean;
  carryoverSourcePeriodId: string | null;
  agent: { id: string; name: string };
};
export type Period = {
  id: string; weekStart: string; weekEnd: string; quarterLabel: string;
  status: string; entries: Entry[]; serviceEntries: ServiceEntry[];
  agentAdjustments?: AgentAdjustment[];
};
export type ProductType = "CORE" | "ADDON" | "AD_D" | "ACA_PL";
export type Product = {
  id: string; name: string; active: boolean; type: ProductType;
  premiumThreshold?: number | null; commissionBelow?: number | null;
  commissionAbove?: number | null; bundledCommission?: number | null;
  standaloneCommission?: number | null; enrollFeeThreshold?: number | null;
  notes?: string;
};
export type StatusChangeRequest = {
  id: string;
  saleId: string;
  oldStatus: string;
  newStatus: string;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};
export type SaleEditRequest = {
  id: string;
  saleId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};

export type Alert = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  customerName: string | null;
  amount: number | null;
  createdAt: string;
  // GAP-46-UAT-05 (46-10): identity + match status from the chargeback include
  chargebackSubmissionId: string;
  chargeback?: {
    id: string;
    matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED" | null;
    matchedSaleId: string | null;
    memberId: string | null;
    memberCompany: string | null;
    payeeName: string | null;
    memberAgentCompany: string | null;
  } | null;
};

export type AlertPeriod = { id: string; weekStart: string; weekEnd: string };

export type SocketClient = import("socket.io-client").Socket;

/* ── New types for agent-first data model ──────────────────── */

export type AgentPeriodData = {
  period: Period;
  entries: Entry[];
  adjustment?: AgentAdjustment;
  gross: number;
  net: number;
  activeCount: number;
};

export type AgentData = {
  agentId: string;
  agentName: string;
  periods: AgentPeriodData[];
};

export type SidebarAgent = {
  agentName: string;
  agentId: string;
  gross: number;
  net: number;
  activeCount: number;
  isTopEarner: boolean;
  isCS: boolean;
  status: "paid" | "unpaid" | "partial" | null;
};

/* ── Style constants ─────────────────────────────────────────── */

export const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

export const SMALL_INP: React.CSSProperties = {
  ...baseInputStyle,
  padding: "6px 10px",
  fontSize: 13,
  width: 90,
  textAlign: "right",
  boxSizing: "border-box",
};

export const thStyle: React.CSSProperties = {
  ...baseThStyle,
  background: C.bgSurface,
  position: "sticky",
  top: 0,
};

export const thRight: React.CSSProperties = { ...thStyle, textAlign: "right" };
export const thCenter: React.CSSProperties = { ...thStyle, textAlign: "center" };

export const tdStyle: React.CSSProperties = { ...baseTdStyle, borderBottom: "none" };
export const tdRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };
export const tdCenter: React.CSSProperties = { ...tdStyle, textAlign: "center" };

/* ── Status config ───────────────────────────────────────────── */

export const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  OPEN:      { color: C.accentTeal,  label: "Open" },
  LOCKED:    { color: C.danger,      label: "Closed" },
  FINALIZED: { color: C.success,     label: "Finalized" },
};

export const SALE_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  RAN:      { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "Ran" },
  DECLINED: { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Declined" },
  DEAD:     { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: "Dead" },
};

/* ── Enrollment bonus constants ──────────────────────────────── */

export const ENROLLMENT_BONUS_THRESHOLD = 125;

export const ENROLLMENT_BADGE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: C.warningBg,
  color: C.warning,
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 9999,
  padding: "2px 6px",
  marginLeft: 4,
};

export const ACA_BADGE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 11,
  fontWeight: 600,
  color: C.info,
  background: C.infoBg,
  padding: "4px 8px",
  borderRadius: 9999,
  marginLeft: 8,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

/* ── Label styles ──────────────────────────────────────────── */

export const EDITABLE_LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 2,
};

export const HEADER_LBL: React.CSSProperties = {
  fontSize: 11, color: C.textMuted, textTransform: "uppercase",
  letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2,
};

/* ── Helper functions ──────────────────────────────────────── */

/** Returns true if the payroll entry counts toward period totals (RAN sales only) */
export function isActiveEntry(e: Entry): boolean {
  if (e.status === "ZEROED_OUT") return false;
  if (e.sale?.status && e.sale.status !== "RAN") return false;
  return true;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}
