export type SaleChangedType = "created" | "updated" | "status_changed" | "deleted";

export interface SaleChangedPayload {
  type: SaleChangedType;
  sale: {
    id: string;
    saleDate: string;
    memberName: string;
    memberId?: string;
    carrier: string;
    premium: number;
    enrollmentFee: number | null;
    status: string;
    agent: { id: string; name: string };
    product: { id: string; name: string; type: string };
    addons?: { product: { id: string; name: string; type: string } }[];
  };
  payrollEntries: {
    id: string;
    payoutAmount: number;
    adjustmentAmount: number;
    bonusAmount: number;
    frontedAmount: number;
    holdAmount: number;
    netAmount: number;
    status: string;
    periodId: string;
    periodWeekStart: string;
    periodWeekEnd: string;
  }[];
}

export const DISCONNECT_BANNER: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  padding: "8px 16px",
  background: "rgba(239, 68, 68, 0.9)",
  color: "#fff",
  textAlign: "center",
  fontSize: 13,
  fontWeight: 700,
  zIndex: 9999,
  backdropFilter: "blur(8px)",
};

export const HIGHLIGHT_GLOW: React.CSSProperties = {
  boxShadow: "0 0 20px rgba(59, 130, 246, 0.15), 0 0 40px rgba(59, 130, 246, 0.08)",
};
