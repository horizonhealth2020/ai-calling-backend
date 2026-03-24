"use client";
import { useState } from "react";
import { Button, Card, DateRangeFilter, KPI_PRESETS } from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { colors, spacing, radius, baseLabelStyle } from "@ops/ui";
import { Download } from "lucide-react";

const C = colors;
const S = spacing;
const R = radius;
const LBL: React.CSSProperties = { ...baseLabelStyle };

/* ── Types ──────────────────────────────────────────────────── */

type SaleAddonInfo = { productId: string; premium: number | null; product: { id: string; name: string; type: string } };
type SaleInfo = {
  id: string; memberName: string; memberId?: string; carrier: string;
  premium: number; enrollmentFee: number | null; commissionApproved: boolean;
  status: string; notes?: string;
  product: { id: string; name: string; type: string };
  addons?: SaleAddonInfo[];
};
type Entry = {
  id: string; payoutAmount: number; adjustmentAmount: number; bonusAmount: number;
  frontedAmount: number; holdAmount: number; netAmount: number; status: string;
  sale?: SaleInfo; agent?: { name: string };
};
type ServiceEntry = {
  id: string; basePay: number; bonusAmount: number; deductionAmount: number;
  frontedAmount?: number; totalPay: number; bonusBreakdown?: Record<string, number>;
  status: string; notes?: string; serviceAgent: { name: string; basePay: number };
};
type Period = {
  id: string; weekStart: string; weekEnd: string; quarterLabel: string;
  status: string; entries: Entry[]; serviceEntries: ServiceEntry[];
};

function isActiveEntry(e: Entry): boolean {
  if (e.status === "ZEROED_OUT") return false;
  if (e.sale?.status && e.sale.status !== "RAN") return false;
  return true;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

/* ── Props ──────────────────────────────────────────────────── */

export interface PayrollExportsProps {
  API: string;
  periods: Period[];
}

/* ── Component ──────────────────────────────────────────────── */

export default function PayrollExports({ API, periods }: PayrollExportsProps) {
  const [exportDateFilter, setExportDateFilter] = useState<DateRangeFilterValue>({ preset: "week" });
  const [exporting, setExporting] = useState(false);

  function filterPeriodsByDateRange(filter: DateRangeFilterValue): Period[] {
    let from: Date | null = null;
    let to: Date | null = null;
    if (filter.preset === "custom" && filter.from && filter.to) {
      from = new Date(filter.from + "T00:00:00");
      to = new Date(filter.to + "T23:59:59.999");
    } else if (filter.preset === "week") {
      const now = new Date();
      const day = now.getDay();
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      to = new Date(); to.setHours(23, 59, 59, 999);
    } else if (filter.preset === "last_week") {
      const now = new Date();
      const day = now.getDay();
      const thisSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      from = new Date(thisSunday); from.setDate(from.getDate() - 7);
      to = new Date(thisSunday); to.setMilliseconds(-1);
    } else if (filter.preset === "7d") {
      from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
      to = new Date(); to.setHours(23, 59, 59, 999);
    } else if (filter.preset === "30d") {
      from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
      to = new Date(); to.setHours(23, 59, 59, 999);
    } else if (filter.preset === "month") {
      from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
      to = new Date(); to.setHours(23, 59, 59, 999);
    }
    if (!from || !to) return periods;
    return periods.filter(p => {
      const start = new Date(p.weekStart);
      return start >= from! && start <= to!;
    });
  }

  function exportCSV() {
    const filtered = filterPeriodsByDateRange(exportDateFilter);
    const rows = [["Week Start", "Week End", "Quarter", "Status", "Entries", "Gross", "Net"]];
    filtered.forEach(p => {
      const active = p.entries.filter(isActiveEntry);
      const gross = active.reduce((s, e) => s + Number(e.payoutAmount), 0);
      const net   = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
      rows.push([p.weekStart, p.weekEnd, p.quarterLabel, p.status, String(active.length), gross.toFixed(2), net.toFixed(2)]);
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `payroll-summary.csv`,
    });
    a.click();
  }

  function exportDetailedCSV() {
    const filtered = filterPeriodsByDateRange(exportDateFilter);
    const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const rows: string[][] = [];

    // ── Commission Agent Section ───────────────────────────────
    // Step 1: Collect all entries across periods, tagged with period info
    type TaggedEntry = { entry: Entry; weekStart: string; weekEnd: string; quarterLabel: string };
    const tagged: TaggedEntry[] = [];
    for (const p of filtered) {
      for (const e of p.entries) {
        tagged.push({ entry: e, weekStart: p.weekStart, weekEnd: p.weekEnd, quarterLabel: p.quarterLabel });
      }
    }

    // Step 2: Group by agent name
    const agentMap = new Map<string, TaggedEntry[]>();
    for (const t of tagged) {
      const name = t.entry.agent?.name ?? "Unknown";
      if (!agentMap.has(name)) agentMap.set(name, []);
      agentMap.get(name)!.push(t);
    }

    // Step 3: Sort agents alphabetically (D-05)
    const sortedAgents = [...agentMap.keys()].sort((a, b) => a.localeCompare(b));

    // Commission column headers
    rows.push(["Week Start","Week End","Quarter","Agent","Member ID","Member Name","Core","Add-on","AD&D","Enroll Fee","Commission","Bonus","Fronted","Hold","Net"]);

    for (const agentName of sortedAgents) {
      const agentEntries = agentMap.get(agentName)!;

      // Step 4: Group this agent's entries by period (weekStart)
      const periodMap = new Map<string, TaggedEntry[]>();
      for (const t of agentEntries) {
        if (!periodMap.has(t.weekStart)) periodMap.set(t.weekStart, []);
        periodMap.get(t.weekStart)!.push(t);
      }

      // Sort periods chronologically (D-05)
      const sortedPeriodKeys = [...periodMap.keys()].sort((a, b) => a.localeCompare(b));

      for (const periodKey of sortedPeriodKeys) {
        const periodEntries = periodMap.get(periodKey)!;
        const sample = periodEntries[0];

        // Header row (D-06): agent name + week range
        rows.push([esc(`${agentName} | Week ${fmtDate(sample.weekStart)} to ${fmtDate(sample.weekEnd)}`)]);

        let pCommission = 0, pBonus = 0, pFronted = 0, pHold = 0, pNet = 0;

        for (const t of periodEntries) {
          const e = t.entry;
          const byType: Record<string, string[]> = { CORE: [], ADDON: [], AD_D: [] };
          if (e.sale?.product?.type) byType[e.sale.product.type]?.push(e.sale.product.name);
          if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push(ad.product.name);
          const fee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee).toFixed(2) : "";
          const commission = Number(e.payoutAmount);
          const bonus = Number(e.bonusAmount);
          const fronted = Number(e.frontedAmount);
          const hold = Number(e.holdAmount ?? 0);
          const net = Number(e.netAmount);
          pCommission += commission; pBonus += bonus; pFronted += fronted; pHold += hold; pNet += net;

          rows.push([
            fmtDate(t.weekStart), fmtDate(t.weekEnd), t.quarterLabel,
            esc(agentName), e.sale?.memberId ?? "", esc(e.sale?.memberName ?? ""),
            esc(byType.CORE.join(", ")), esc(byType.ADDON.join(", ")), esc(byType.AD_D.join(", ")),
            fee, commission.toFixed(2), bonus.toFixed(2),
            fronted.toFixed(2), hold.toFixed(2), net.toFixed(2),
          ]);
        }

        // Subtotal row (D-06)
        rows.push([
          "", "", "", esc(agentName + " \u2014 Subtotal"), "", "",
          "", "", "", "",
          pCommission.toFixed(2), pBonus.toFixed(2),
          pFronted.toFixed(2), pHold.toFixed(2), pNet.toFixed(2),
        ]);
      }

      // Blank separator between agents
      rows.push([""]);
    }

    // ── Service Staff Section (D-08, D-09) ─────────────────────
    // Collect all service entries across filtered periods
    type TaggedServiceEntry = { entry: ServiceEntry; weekStart: string; weekEnd: string };
    const taggedService: TaggedServiceEntry[] = [];
    for (const p of filtered) {
      for (const se of p.serviceEntries) {
        taggedService.push({ entry: se, weekStart: p.weekStart, weekEnd: p.weekEnd });
      }
    }

    if (taggedService.length > 0) {
      // Section separator
      rows.push([""]);
      rows.push(["=== SERVICE STAFF ==="]);

      // Service staff column headers (D-09: different from commission columns)
      rows.push(["Week Start", "Week End", "Service Agent", "Base Pay", "Bonus", "Deductions", "Fronted", "Total Pay"]);

      // Group by service agent name
      const serviceMap = new Map<string, TaggedServiceEntry[]>();
      for (const t of taggedService) {
        const name = t.entry.serviceAgent.name;
        if (!serviceMap.has(name)) serviceMap.set(name, []);
        serviceMap.get(name)!.push(t);
      }

      const sortedServiceAgents = [...serviceMap.keys()].sort((a, b) => a.localeCompare(b));

      for (const saName of sortedServiceAgents) {
        const saEntries = serviceMap.get(saName)!;

        // Group by period
        const saPeriodMap = new Map<string, TaggedServiceEntry[]>();
        for (const t of saEntries) {
          if (!saPeriodMap.has(t.weekStart)) saPeriodMap.set(t.weekStart, []);
          saPeriodMap.get(t.weekStart)!.push(t);
        }

        const sortedSaPeriods = [...saPeriodMap.keys()].sort((a, b) => a.localeCompare(b));

        for (const pk of sortedSaPeriods) {
          const entries = saPeriodMap.get(pk)!;
          const sample = entries[0];

          // Header row for service agent
          rows.push([esc(`${saName} | Week ${fmtDate(sample.weekStart)} to ${fmtDate(sample.weekEnd)}`)]);

          for (const t of entries) {
            const se = t.entry;
            rows.push([
              fmtDate(t.weekStart), fmtDate(t.weekEnd), esc(saName),
              Number(se.basePay).toFixed(2),
              Number(se.bonusAmount).toFixed(2),
              Number(se.deductionAmount).toFixed(2),
              Number(se.frontedAmount ?? 0).toFixed(2),
              Number(se.totalPay).toFixed(2),
            ]);
          }
        }

        rows.push([""]);
      }
    }

    // Download
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: "payroll-detailed.csv",
    });
    a.click();
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 560 }}>
      <p style={{ color: C.textMuted, marginTop: 0, fontSize: 14, marginBottom: S[5], lineHeight: 1.7 }}>
        Download payroll period data as a CSV file. Choose a time range and export format.
      </p>

      <Card style={{ borderRadius: R["2xl"] }}>
        {/* Date range selector */}
        <div style={{ marginBottom: S[6] }}>
          <label style={LBL}>Date Range</label>
          <DateRangeFilter value={exportDateFilter} onChange={setExportDateFilter} presets={KPI_PRESETS} />
        </div>

        {/* Export actions */}
        <div style={{ display: "grid", gap: S[3] }}>
          {/* Summary CSV */}
          <Card padding="sm" style={{ padding: S[5], display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>Summary CSV</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Week range, status, entries count, gross and net per period</div>
            </div>
            <Button
              variant="ghost"
              onClick={() => { setExporting(true); exportCSV(); setTimeout(() => setExporting(false), 800); }}
              style={{ flexShrink: 0 }}
            >
              <Download size={14} /> Export
            </Button>
          </Card>

          {/* Detailed CSV */}
          <Card padding="sm" style={{ padding: S[5], display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>Detailed CSV</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Per-entry rows -- agent, member, products, fees, commission, bonus, fronted, net</div>
            </div>
            <Button
              variant="primary"
              onClick={() => { setExporting(true); exportDetailedCSV(); setTimeout(() => setExporting(false), 800); }}
              style={{ flexShrink: 0 }}
            >
              <Download size={14} /> Export
            </Button>
          </Card>
        </div>
      </Card>
    </div>
  );
}
