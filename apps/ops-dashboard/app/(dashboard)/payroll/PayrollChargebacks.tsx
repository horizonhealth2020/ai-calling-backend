"use client";
import { useState, type FormEvent } from "react";
import { Button, Card } from "@ops/ui";
import { colors, spacing, radius, baseInputStyle, baseLabelStyle } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { CheckCircle, XCircle, AlertTriangle, Search } from "lucide-react";

const C = colors;
const S = spacing;
const R = radius;

const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = { ...baseLabelStyle };

type LookupProduct = { id: string; name: string; type: string };
type LookupResult = { saleId: string; memberName: string; memberId: string | null; products: LookupProduct[] };

const PRODUCT_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  CORE: { bg: "rgba(20,184,166,0.15)", fg: "#14b8a6" },
  ADDON: { bg: "rgba(13,148,136,0.15)", fg: "#0d9488" },
  AD_D: { bg: "rgba(217,119,6,0.15)", fg: "#d97706" },
  ACA_PL: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6" },
};

export interface PayrollChargebacksProps {
  API: string;
}

export default function PayrollChargebacks({ API }: PayrollChargebacksProps) {
  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [allSelected, setAllSelected] = useState(true);

  async function lookupSale() {
    setChargebackMsg("");
    setLookupResult(null);
    setSelectedProductIds([]);
    setAllSelected(true);

    const { memberId, memberName } = chargebackForm;
    if (!memberId && !memberName) {
      setChargebackMsg("Error: Enter a Member ID or Member Name to look up");
      return;
    }

    setLookupLoading(true);
    try {
      const params = new URLSearchParams();
      if (memberId) params.set("memberId", memberId);
      else if (memberName) params.set("memberName", memberName);

      const res = await authFetch(`${API}/api/clawbacks/lookup?${params}`);
      if (res.ok) {
        const data: LookupResult = await res.json();
        setLookupResult(data);
        setSelectedProductIds(data.products.map(p => p.id));
        setAllSelected(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setChargebackMsg(`Error: Unable to reach API \u2014 ${message}`);
    } finally {
      setLookupLoading(false);
    }
  }

  function toggleProduct(productId: string) {
    setSelectedProductIds(prev => {
      const next = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      setAllSelected(lookupResult ? next.length === lookupResult.products.length : false);
      return next;
    });
  }

  function toggleAll() {
    if (!lookupResult) return;
    if (allSelected) {
      setSelectedProductIds([]);
      setAllSelected(false);
    } else {
      setSelectedProductIds(lookupResult.products.map(p => p.id));
      setAllSelected(true);
    }
  }

  async function submitChargeback(e: FormEvent) {
    e.preventDefault();
    setChargebackMsg("");

    if (!lookupResult) {
      setChargebackMsg("Error: Look up a sale first before processing chargeback");
      return;
    }

    if (selectedProductIds.length === 0) {
      setChargebackMsg("Error: Select at least one product to chargeback");
      return;
    }

    try {
      const body: Record<string, unknown> = {};
      if (chargebackForm.memberId) body.memberId = chargebackForm.memberId;
      if (chargebackForm.memberName) body.memberName = chargebackForm.memberName;
      if (chargebackForm.notes) body.notes = chargebackForm.notes;
      // Only send productIds if not all are selected (backward compat)
      if (!allSelected) {
        body.productIds = selectedProductIds;
      }

      const res = await authFetch(`${API}/api/clawbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const suffix = allSelected ? "" : ` (${selectedProductIds.length} of ${lookupResult.products.length} products)`;
        setChargebackMsg(`Chargeback processed successfully${suffix}`);
        setChargebackForm({ memberName: "", memberId: "", notes: "" });
        setLookupResult(null);
        setSelectedProductIds([]);
        setAllSelected(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setChargebackMsg(`Error: Unable to reach API \u2014 ${message}`);
    }
  }

  function handleInputChange(field: "memberId" | "memberName", value: string) {
    setChargebackForm(f => ({ ...f, [field]: value }));
    // Reset lookup when inputs change
    if (lookupResult) {
      setLookupResult(null);
      setSelectedProductIds([]);
      setAllSelected(true);
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 540 }}>
      <p style={{ color: C.textMuted, marginTop: 0, marginBottom: S[5], fontSize: 14, lineHeight: 1.7 }}>
        Look up a sale by Member ID (preferred) or Member Name, select products to chargeback, then process. Chargebacks target the oldest open payroll period.
      </p>

      <Card style={{ borderRadius: R["2xl"] }}>
        <form onSubmit={submitChargeback} style={{ display: "grid", gap: S[5] }}>
          {/* Step 1: Member lookup */}
          <div>
            <label style={LBL}>Member ID <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(preferred)</span></label>
            <input
              className="input-focus"
              style={inputStyle}
              value={chargebackForm.memberId}
              placeholder="e.g. M-12345"
              onChange={e => handleInputChange("memberId", e.target.value)}
            />
          </div>
          <div>
            <label style={LBL}>Member Name <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(if no ID)</span></label>
            <input
              className="input-focus"
              style={inputStyle}
              value={chargebackForm.memberName}
              placeholder="e.g. John Doe"
              onChange={e => handleInputChange("memberName", e.target.value)}
            />
          </div>

          {!lookupResult && (
            <Button
              variant="secondary"
              type="button"
              onClick={lookupSale}
              disabled={lookupLoading || (!chargebackForm.memberId && !chargebackForm.memberName)}
              style={{ justifySelf: "start" }}
            >
              <Search size={14} style={{ marginRight: 4 }} />
              {lookupLoading ? "Looking up..." : "Lookup Sale"}
            </Button>
          )}

          {/* Step 2: Product selection */}
          {lookupResult && (
            <div style={{
              background: C.bgSurfaceRaised,
              borderRadius: R.lg,
              padding: S[4],
              border: `1px solid ${C.borderSubtle}`,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: "0.06em", color: C.textTertiary, marginBottom: S[3],
              }}>
                Products on sale ({lookupResult.products.length})
              </div>

              {/* All Products toggle */}
              <label style={{
                display: "flex", alignItems: "center", gap: S[2],
                padding: `${S[2]}px 0`, cursor: "pointer",
                borderBottom: `1px solid ${C.borderSubtle}`, marginBottom: S[2],
              }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ accentColor: C.primary, width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 700, fontSize: 13, color: C.textPrimary }}>All Products</span>
              </label>

              {/* Individual products */}
              {lookupResult.products.map(p => {
                const typeColor = PRODUCT_TYPE_COLORS[p.type] ?? { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8" };
                return (
                  <label key={p.id} style={{
                    display: "flex", alignItems: "center", gap: S[2],
                    padding: `${S[2]}px 0`, cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      style={{ accentColor: C.primary, width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, color: C.textPrimary }}>{p.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 6px",
                      borderRadius: 4, background: typeColor.bg, color: typeColor.fg,
                      textTransform: "uppercase" as const,
                    }}>
                      {p.type.replace("_", " ")}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div>
            <label style={LBL}>Notes</label>
            <textarea
              className="input-focus"
              style={{ ...inputStyle, height: 88, resize: "vertical" } as React.CSSProperties}
              value={chargebackForm.notes}
              onChange={e => setChargebackForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: S[4], flexWrap: "wrap" }}>
            {lookupResult && (
              <Button
                variant="danger"
                type="submit"
                disabled={selectedProductIds.length === 0}
              >
                <XCircle size={15} /> Process Chargeback
              </Button>
            )}
            {chargebackMsg && (
              <div style={{
                display: "flex", alignItems: "center", gap: S[2],
                color: chargebackMsg.startsWith("Chargeback") ? C.success : C.danger,
                fontWeight: 600, fontSize: 13,
              }}>
                {chargebackMsg.startsWith("Chargeback")
                  ? <CheckCircle size={14} />
                  : <AlertTriangle size={14} />}
                {chargebackMsg}
              </div>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
