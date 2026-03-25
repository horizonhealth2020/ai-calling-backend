"use client";
import { useState, type FormEvent } from "react";
import { Button, Card } from "@ops/ui";
import { colors, spacing, radius, baseInputStyle, baseLabelStyle } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const C = colors;
const S = spacing;
const R = radius;

const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = { ...baseLabelStyle };

export interface PayrollChargebacksProps {
  API: string;
}

export default function PayrollChargebacks({ API }: PayrollChargebacksProps) {
  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");

  async function submitChargeback(e: FormEvent) {
    e.preventDefault(); setChargebackMsg("");
    try {
      const body = Object.fromEntries(Object.entries(chargebackForm).filter(([, v]) => v));
      const res = await authFetch(`${API}/api/clawbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setChargebackMsg("Chargeback processed successfully");
        setChargebackForm({ memberName: "", memberId: "", notes: "" });
      } else {
        const err = await res.json().catch(() => ({}));
        setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`);
      }
    } catch (e: unknown) {
      setChargebackMsg(`Error: Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`);
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 540 }}>
      <p style={{ color: C.textMuted, marginTop: 0, marginBottom: S[5], fontSize: 14, lineHeight: 1.7 }}>
        Match by Member ID (preferred) or Member Name to process a chargeback. A deduction entry will be applied to the current week.
      </p>

      <Card style={{ borderRadius: R["2xl"] }}>
        <form onSubmit={submitChargeback} style={{ display: "grid", gap: S[5] }}>
          <div>
            <label style={LBL}>Member ID <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(preferred)</span></label>
            <input
              className="input-focus"
              style={inputStyle}
              value={chargebackForm.memberId}
              placeholder="e.g. M-12345"
              onChange={e => setChargebackForm(f => ({ ...f, memberId: e.target.value }))}
            />
          </div>
          <div>
            <label style={LBL}>Member Name <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(if no ID)</span></label>
            <input
              className="input-focus"
              style={inputStyle}
              value={chargebackForm.memberName}
              placeholder="e.g. John Doe"
              onChange={e => setChargebackForm(f => ({ ...f, memberName: e.target.value }))}
            />
          </div>
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
            <Button variant="danger" type="submit">
              <XCircle size={15} /> Process Chargeback
            </Button>
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
