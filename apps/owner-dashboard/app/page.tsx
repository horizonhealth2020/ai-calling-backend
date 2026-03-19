"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatDollar, formatDate } from "@ops/utils";
import {
  PageShell,
  StatCard,
  Badge,
  AnimatedNumber,
  EmptyState,
  SkeletonCard,
  SkeletonTable,
  ToastProvider,
  useToast,
  Button,
  colors,
  radius,
  shadows,
  typography,
  motion,
  Select,
  baseCardStyle,
  baseInputStyle,
  baseLabelStyle,
  baseThStyle,
  baseTdStyle,
} from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import { useSocket, DISCONNECT_BANNER, HIGHLIGHT_GLOW } from "@ops/socket";
import type { SaleChangedPayload } from "@ops/socket";
import {
  BarChart3,
  DollarSign,
  Users,
  Shield,
  Settings,
  Edit3,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Award,
  UserPlus,
  Check,
  Clock,
  Lock,
  Database,
  Activity,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type ActiveSection = "dashboard" | "config" | "users" | "kpis";
type Range = "today" | "week" | "month";
type Summary = {
  salesCount: number; premiumTotal: number; clawbacks: number; openPayrollPeriods: number;
  trends: { salesCount: { priorWeek: number; priorMonth: number }; premiumTotal: { priorWeek: number; priorMonth: number }; clawbacks: { priorWeek: number; priorMonth: number } } | null;
};
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number; commissionTotal: number };
type PeriodSummary = { period: string; salesCount: number; premiumTotal: number; commissionPaid: number; periodStatus?: string };
type User = { id: string; name: string; email: string; roles: string[]; active: boolean; createdAt: string };
type AgentInfo = { id: string; name: string; email?: string; active?: boolean; auditEnabled?: boolean };
type AgentKpi = { agentId: string; agentName: string; chargebackCount: number; chargebackTotal: number; pendingTermCount: number };
type KpiData = { agents: AgentKpi[]; totals: { totalChargebackCount: number; totalChargebackDollars: number; totalPendingTermCount: number } };
type PermUser = { id: string; name: string; roles: string[]; permissions: Record<string, { granted: boolean; isDefault: boolean; isOverride: boolean }> };
type PermData = { users: PermUser[]; configurablePermissions: string[] };
type StorageStats = { dbSizeMB: number; planLimitMB: number; usagePct: number; thresholdPct: number; alertActive: boolean };

function computeTrend(current: number, prior: number): { value: number; direction: "up" | "down" | "flat" } {
  if (prior === 0) return current > 0 ? { value: 100, direction: "up" } : { value: 0, direction: "flat" };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { value: 0, direction: "flat" };
  return { value: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

const ROLES = ["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN", "CUSTOMER_SERVICE"] as const;

const RANGE_LABELS: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "#14b8a6",
  OWNER_VIEW: "#059669",
  MANAGER: "#0d9488",
  PAYROLL: "#d97706",
  SERVICE: "#64748b",
  ADMIN: "#0f766e",
  CUSTOMER_SERVICE: "#f59e0b",
};

const RANK_COLORS = ["#fbbf24", "#94a3b8", "#d97706"] as const;
const RANK_LABELS = ["Gold", "Silver", "Bronze"] as const;

const PERM_LABELS: Record<string, string> = {
  "create:sale": "Sales",
  "create:chargeback": "Chargebacks",
  "create:pending_term": "Pending Terms",
  "create:rep": "Reps",
  "create:agent": "Agents",
  "create:product": "Products",
  "create:lead_source": "Lead Sources",
};

/* ── Inline style constants ─────────────────────────────────────── */

const CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius["2xl"],
};

const LBL: React.CSSProperties = {
  ...baseLabelStyle,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: typography.sizes.md.fontSize,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  letterSpacing: typography.tracking.tight,
  margin: 0,
};

const SECTION_SUBTITLE: React.CSSProperties = {
  fontSize: typography.sizes.sm.fontSize,
  color: colors.textTertiary,
  margin: "4px 0 0",
};

const TD: React.CSSProperties = {
  ...baseTdStyle,
};

const STORAGE_ALERT: React.CSSProperties = {
  background: "rgba(234, 179, 8, 0.08)",
  borderLeft: `4px solid ${colors.warning ?? "#eab308"}`,
  borderRadius: radius.lg,
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
  gap: 12,
};

const INP: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box" as const,
};

/* ── Nav items ─────────────────────────────────────────────────── */

const NAV_ITEMS_BASE = [
  { icon: <BarChart3 size={18} />, label: "Dashboard", key: "dashboard" },
  { icon: <Activity size={18} />, label: "KPIs", key: "kpis" },
  { icon: <Settings size={18} />, label: "AI Config", key: "config" },
];

const NAV_ITEMS_ADMIN = [
  ...NAV_ITEMS_BASE,
  { icon: <Users size={18} />, label: "Users", key: "users" },
];

/* ── RoleCheckboxes ─────────────────────────────────────────────── */

function RoleCheckboxes({ selected, onChange }: { selected: string[]; onChange: (roles: string[]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {ROLES.map((r) => {
        const checked = selected.includes(r);
        const c = ROLE_COLORS[r];
        return (
          <label
            key={r}
            className="input-focus"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: checked ? 700 : 500,
              padding: "6px 12px",
              borderRadius: radius.full,
              border: `1px solid ${checked ? c + "50" : colors.borderDefault}`,
              background: checked ? c + "15" : "transparent",
              color: checked ? c : colors.textSecondary,
              transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked ? [...selected, r] : selected.filter((x) => x !== r))}
              style={{ accentColor: c, width: 13, height: 13 }}
            />
            {r}
          </label>
        );
      })}
    </div>
  );
}

/* ── Inline delete confirmation bar ──────────────────────────────── */

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="animate-slide-down"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: colors.dangerBg,
        border: `1px solid ${colors.danger}30`,
        borderRadius: radius.lg,
      }}
    >
      <AlertTriangle size={15} color={colors.danger} />
      <span style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
        Permanently delete <strong style={{ color: colors.textPrimary }}>{name}</strong>? This cannot be undone.
      </span>
      <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={onConfirm}>
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/* ── UserRow ────────────────────────────────────────────────────── */

function UserRow({
  user,
  onSave,
  onDelete,
}: {
  user: User;
  onSave: (id: string, data: Partial<User> & { password?: string }) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [d, setD] = useState({ name: user.name, email: user.email, roles: user.roles, active: user.active, password: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  if (confirmDelete) {
    return (
      <tr>
        <td colSpan={5} style={{ ...baseTdStyle, padding: "10px 16px" }}>
          <DeleteConfirm
            name={user.name}
            onConfirm={async () => {
              const e = await onDelete(user.id);
              if (e) {
                toast("error", e);
                setConfirmDelete(false);
              }
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        </td>
      </tr>
    );
  }

  if (!edit) {
    return (
      <tr className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
        <td style={{ ...baseTdStyle, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>{user.name}</td>
        <td style={{ ...baseTdStyle, color: colors.textSecondary, fontSize: 13 }}>{user.email}</td>
        <td style={baseTdStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {user.roles.map((r) => (
              <Badge key={r} color={ROLE_COLORS[r] ?? colors.textTertiary} size="sm">
                {r}
              </Badge>
            ))}
          </div>
        </td>
        <td style={baseTdStyle}>
          <Badge
            color={user.active ? colors.success : colors.textMuted}
            dot
            size="sm"
          >
            {user.active ? "Active" : "Inactive"}
          </Badge>
        </td>
        <td style={{ ...baseTdStyle, textAlign: "right" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              title="Edit user"
              className="btn-hover"
              onClick={() => setEdit(true)}
              style={{
                padding: "6px 8px",
                background: "transparent",
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: radius.md,
                color: colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              <Edit3 size={14} />
            </button>
            <button
              title="Delete user"
              className="btn-hover"
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: "6px 8px",
                background: colors.dangerBg,
                border: `1px solid ${colors.danger}25`,
                borderRadius: radius.md,
                color: colors.danger,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td
        colSpan={5}
        className="animate-slide-down"
        style={{
          ...TD,
          background: colors.bgSurfaceRaised,
          padding: 20,
          borderLeft: `3px solid ${colors.accentTeal}`,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={LBL}>Name</label>
            <input className="input-focus" style={{ ...baseInputStyle, boxSizing: "border-box" }} value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} />
          </div>
          <div>
            <label style={LBL}>Email</label>
            <input className="input-focus" style={{ ...baseInputStyle, boxSizing: "border-box" }} value={d.email} onChange={(e) => setD((x) => ({ ...x, email: e.target.value }))} />
          </div>
          <div>
            <label style={LBL}>New Password</label>
            <input
              className="input-focus"
              style={{ ...baseInputStyle, boxSizing: "border-box" }}
              type="password"
              placeholder="Leave blank to keep"
              value={d.password}
              onChange={(e) => setD((x) => ({ ...x, password: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Roles</label>
          <RoleCheckboxes selected={d.roles} onChange={(roles) => setD((x) => ({ ...x, roles }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Select
            label="Status"
            style={{ width: "auto" }}
            value={String(d.active)}
            onChange={(e) => setD((x) => ({ ...x, active: e.target.value === "true" }))}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
        {err && (
          <div
            className="animate-fade-in"
            style={{
              color: colors.danger,
              fontSize: 13,
              marginBottom: 12,
              padding: "10px 14px",
              background: colors.dangerBg,
              borderRadius: radius.lg,
              border: `1px solid ${colors.danger}25`,
            }}
          >
            {err}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={13} />}
            loading={saving}
            disabled={saving || d.roles.length === 0}
            onClick={async () => {
              setSaving(true);
              setErr("");
              const payload: Record<string, unknown> = { name: d.name, email: d.email, roles: d.roles, active: d.active };
              if (d.password) payload.password = d.password;
              const e = await onSave(user.id, payload);
              if (e) {
                setErr(e);
                setSaving(false);
              } else {
                toast("success", `${d.name} saved successfully`);
                setEdit(false);
              }
            }}
          >
            Save Changes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<X size={13} />}
            onClick={() => {
              setEdit(false);
              setErr("");
            }}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* ── Range picker ───────────────────────────────────────────────── */

function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: colors.bgSurfaceInset,
        borderRadius: radius.lg,
        padding: 3,
        border: `1px solid ${colors.borderSubtle}`,
      }}
    >
      {RANGE_LABELS.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className="btn-hover"
          style={{
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: typography.weights.semibold,
            border: "none",
            cursor: "pointer",
            borderRadius: radius.md,
            background: value === r.value ? colors.bgSurfaceOverlay : "transparent",
            color: value === r.value ? colors.textPrimary : colors.textMuted,
            boxShadow: value === r.value ? shadows.sm : "none",
            transition: `all ${motion.duration.fast} ${motion.easing.out}`,
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/* ── Dashboard section ──────────────────────────────────────────── */

function DashboardSection({
  summary,
  tracker,
  range,
  onRangeChange,
  highlightedCards,
  periods,
  periodView,
  onPeriodViewChange,
}: {
  summary: Summary | null;
  tracker: TrackerEntry[];
  range: Range;
  onRangeChange: (r: Range) => void;
  highlightedCards: Set<string>;
  periods: PeriodSummary[];
  periodView: "weekly" | "monthly";
  onPeriodViewChange: (v: "weekly" | "monthly") => void;
}) {
  const sortedTracker = [...tracker].sort((a, b) => b.premiumTotal - a.premiumTotal);

  return (
    <>
      {/* Range + KPI row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>Performance Overview</h2>
          <p style={SECTION_SUBTITLE}>Real-time sales metrics and agent leaderboard</p>
        </div>
        <RangePicker value={range} onChange={onRangeChange} />
      </div>

      {/* KPI stat cards */}
      <div
        className="grid-mobile-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}
      >
        <StatCard
          label="Total Sales"
          value={summary ? summary.salesCount : "—"}
          icon={<BarChart3 size={18} />}
          accent={colors.accentTeal}
          className="stagger-1"
          style={{ borderTop: `3px solid ${colors.accentTeal}`, transition: "box-shadow 1.5s ease-out", ...(highlightedCards.has("salesCount") ? HIGHLIGHT_GLOW : {}) }}
          trend={summary?.trends ? computeTrend(summary.salesCount, summary.trends.salesCount.priorWeek) : undefined}
        />
        <StatCard
          label="Premium Total"
          value={summary ? fmt.format(Number(summary.premiumTotal)) : "—"}
          icon={<DollarSign size={18} />}
          accent={colors.success}
          className="stagger-2"
          style={{ borderTop: `3px solid ${colors.success}`, transition: "box-shadow 1.5s ease-out", ...(highlightedCards.has("premiumTotal") ? HIGHLIGHT_GLOW : {}) }}
          trend={summary?.trends ? computeTrend(Number(summary.premiumTotal), summary.trends.premiumTotal.priorWeek) : undefined}
        />
        <StatCard
          label="Chargebacks"
          value={summary ? summary.clawbacks : "—"}
          icon={<AlertTriangle size={18} />}
          accent={colors.danger}
          className="stagger-3"
          style={{ borderTop: `3px solid ${colors.danger}` }}
          trend={summary?.trends ? computeTrend(summary.clawbacks, summary.trends.clawbacks.priorWeek) : undefined}
        />
        <StatCard
          label="Open Payroll"
          value={summary ? summary.openPayrollPeriods : "—"}
          icon={<Clock size={18} />}
          accent={colors.warning}
          className="stagger-4"
          style={{ borderTop: `3px solid ${colors.warning}` }}
        />
      </div>

      {/* Agent performance table */}
      <div
        className="animate-fade-in-up stagger-5"
        style={{ ...CARD, padding: 0, overflow: "hidden" }}
      >
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Award size={18} color={colors.warning} />
          <div>
            <h3 style={SECTION_TITLE}>Agent Performance</h3>
            <p style={SECTION_SUBTITLE}>Ranked by premium total for selected period</p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgSurfaceInset }}>
                <th style={baseThStyle}>Rank</th>
                <th style={baseThStyle}>Agent</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Sales</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Premium</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Avg / Sale</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Cost / Sale</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              {sortedTracker.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<BarChart3 size={32} />}
                      title="No agent data yet"
                      description="Sales data will appear here once agents start submitting."
                    />
                  </td>
                </tr>
              )}
              {sortedTracker.map((row, i) => {
                const isTop3 = i < 3;
                const rankColor = isTop3 ? RANK_COLORS[i] : colors.textMuted;
                return (
                  <tr
                    key={row.agent}
                    className="row-hover animate-fade-in-up"
                    style={{
                      borderLeft: isTop3 ? `3px solid ${rankColor}` : "3px solid transparent",
                      transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                    }}
                  >
                    <td style={{ ...baseTdStyle, paddingLeft: isTop3 ? 13 : 16 }}>
                      {isTop3 ? (
                        <Badge color={rankColor} variant="subtle" size="sm">
                          #{i + 1} {RANK_LABELS[i]}
                        </Badge>
                      ) : (
                        <span style={{ color: colors.textMuted, fontSize: 13, fontWeight: typography.weights.medium }}>
                          #{i + 1}
                        </span>
                      )}
                    </td>
                    <td style={{ ...baseTdStyle, fontWeight: isTop3 ? typography.weights.bold : typography.weights.semibold, color: isTop3 ? colors.textPrimary : colors.textSecondary }}>
                      {row.agent}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.bold, color: colors.textSecondary }}>
                      <AnimatedNumber value={row.salesCount} />
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.extrabold }}>
                      {i === 0 ? (
                        <span
                          style={{
                            backgroundImage: "linear-gradient(135deg, #34d399, #10b981, #059669)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }}
                        >
                          <AnimatedNumber value={Number(row.premiumTotal)} prefix="$" decimals={0} />
                        </span>
                      ) : (
                        <span style={{ color: colors.success }}>
                          <AnimatedNumber value={Number(row.premiumTotal)} prefix="$" decimals={0} />
                        </span>
                      )}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: colors.textTertiary }}>
                      {row.salesCount > 0 ? fmt.format(Number(row.premiumTotal) / row.salesCount) : "—"}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: colors.warning, fontWeight: typography.weights.semibold }}>
                      {row.costPerSale > 0 ? fmt.format(row.costPerSale) : "—"}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.bold, color: colors.accentTeal }}>
                      {row.commissionTotal > 0 ? fmt.format(row.commissionTotal) : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Period Summary */}
      <div className="animate-fade-in-up stagger-6" style={{ ...CARD, padding: 0, overflow: "hidden", marginTop: 24 }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={18} color={colors.accentTeal} />
            <div>
              <h3 style={SECTION_TITLE}>Period Summary</h3>
              <p style={SECTION_SUBTITLE}>Aggregate totals by pay period</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["weekly", "monthly"] as const).map(v => (
              <button
                key={v}
                onClick={() => onPeriodViewChange(v)}
                style={{
                  padding: "6px 14px", borderRadius: radius.md, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                  background: periodView === v ? colors.primary500 : colors.bgSurfaceInset,
                  color: periodView === v ? "#fff" : colors.textSecondary,
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgSurfaceInset }}>
                <th style={baseThStyle}>Period</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Sales</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Premium</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Commission</th>
                {periodView === "weekly" && <th style={baseThStyle}>Status</th>}
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 && (
                <tr><td colSpan={periodView === "weekly" ? 5 : 4}><EmptyState icon={<Clock size={32} />} title="No period data" description="Period summaries appear once sales are entered." /></td></tr>
              )}
              {periods.map(p => (
                <tr key={p.period} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                  <td style={baseTdStyle}>{p.period}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.bold }}>{p.salesCount}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.success }}>{fmt.format(p.premiumTotal)}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.accentTeal }}>{fmt.format(p.commissionPaid)}</td>
                  {periodView === "weekly" && <td style={baseTdStyle}><Badge color={p.periodStatus === "OPEN" ? colors.success : colors.textMuted} variant="subtle" size="sm">{p.periodStatus}</Badge></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── Config section ─────────────────────────────────────────────── */

function ConfigSection({
  agents,
  aiPrompt,
  setAiPrompt,
  aiPromptLoaded,
  auditMinSec,
  setAuditMinSec,
  auditMaxSec,
  setAuditMaxSec,
  auditDurationLoaded,
  setAgents,
}: {
  agents: AgentInfo[];
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  aiPromptLoaded: boolean;
  auditMinSec: number;
  setAuditMinSec: (v: number) => void;
  auditMaxSec: number;
  setAuditMaxSec: (v: number) => void;
  auditDurationLoaded: boolean;
  setAgents: React.Dispatch<React.SetStateAction<AgentInfo[]>>;
}) {
  const { toast } = useToast();
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingDuration, setSavingDuration] = useState(false);

  // AI stats & controls
  const [aiStats, setAiStats] = useState<{ todaySpent: number; todayCount: number; dailyBudget: number; queuedCount: number; estimatedMonthly: number } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [autoScoring, setAutoScoring] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    authFetch(`${API}/api/ai/usage-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setAiStats(d);
          setBudgetInput(String(d.dailyBudget));
        }
      })
      .catch(() => {});
  }, []);

  async function handleAutoScore() {
    setAutoScoring(true);
    try {
      const res = await authFetch(`${API}/api/ai/auto-score`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast("success", data.message || `${data.queued} calls queued`);
        // Refresh stats
        const sr = await authFetch(`${API}/api/ai/usage-stats`);
        if (sr.ok) {
          const sd = await sr.json();
          setAiStats(sd);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setAutoScoring(false);
    }
  }

  async function handleSaveBudget() {
    setSavingBudget(true);
    try {
      const res = await authFetch(`${API}/api/ai/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyBudget: parseFloat(budgetInput) || 0 }),
      });
      if (res.ok) {
        const data = await res.json();
        toast("success", `Daily budget updated to ${formatDollar(data.dailyBudget)}`);
        setAiStats((prev) => prev ? { ...prev, dailyBudget: data.dailyBudget } : prev);
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSavingBudget(false);
    }
  }

  async function handleSavePrompt() {
    setSavingPrompt(true);
    try {
      const res = await authFetch(`${API}/api/settings/ai-audit-prompt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (res.ok) {
        toast("success", "AI audit prompt saved");
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleSaveDuration() {
    setSavingDuration(true);
    try {
      const res = await authFetch(`${API}/api/settings/audit-duration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSeconds: auditMinSec, maxSeconds: auditMaxSec }),
      });
      if (res.ok) {
        toast("success", "Duration filter saved");
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSavingDuration(false);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>AI Configuration</h2>
        <p style={SECTION_SUBTITLE}>Manage call audit prompts, agent settings, and webhook configuration</p>
      </div>

      {/* AI Audit Prompt */}
      <div className="animate-fade-in-up stagger-1" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={SECTION_TITLE}>Call Audit System Prompt</h3>
            <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
              Instructs GPT-4o-mini how to evaluate call transcriptions. Should request a JSON response with{" "}
              <code style={{ fontSize: 12, color: colors.primary400, background: colors.bgSurfaceInset, padding: "1px 5px", borderRadius: 3 }}>
                score, summary, coachingNotes
              </code>{" "}
              fields.
            </p>
          </div>
          <Shield size={20} color={colors.primary400} style={{ flexShrink: 0, marginTop: 2 }} />
        </div>
        {!aiPromptLoaded ? (
          <div style={{ height: 200, background: colors.bgSurfaceInset, borderRadius: radius.lg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: colors.textMuted, fontSize: 13 }}>Loading prompt...</span>
          </div>
        ) : (
          <textarea
            className="input-focus"
            style={{
              ...INP,
              minHeight: 480,
              fontFamily: typography.fontMono,
              fontSize: 13,
              lineHeight: 1.7,
              resize: "vertical",
              boxSizing: "border-box",
            }}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Enter your system prompt for AI call auditing..."
          />
        )}
        <div style={{ marginTop: 16 }}>
          <Button variant="success" icon={<Save size={14} />} loading={savingPrompt} onClick={handleSavePrompt}>
            Save Prompt
          </Button>
        </div>
      </div>

      {/* Agent Audit Settings */}
      <div className="animate-fade-in-up stagger-2" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>Agent Audit Settings</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Enable AI call auditing for individual agents. Unchecked agents will have their recordings skipped.
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {agents.filter((a) => a.active !== false).map((a) => (
            <label
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                padding: "10px 14px",
                borderRadius: radius.lg,
                background: a.auditEnabled ? colors.successBg : colors.bgSurfaceInset,
                border: `1px solid ${a.auditEnabled ? colors.success + "30" : colors.borderSubtle}`,
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              <input
                type="checkbox"
                checked={!!a.auditEnabled}
                onChange={async (e) => {
                  const val = e.target.checked;
                  setAgents((prev) => prev.map((ag) => (ag.id === a.id ? { ...ag, auditEnabled: val } : ag)));
                  try {
                    const res = await authFetch(`${API}/api/agents/${a.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ auditEnabled: val }),
                    });
                    if (!res.ok) {
                      setAgents((prev) => prev.map((ag) => (ag.id === a.id ? { ...ag, auditEnabled: !val } : ag)));
                    }
                  } catch {
                    setAgents((prev) => prev.map((ag) => (ag.id === a.id ? { ...ag, auditEnabled: !val } : ag)));
                  }
                }}
                style={{ width: 15, height: 15, accentColor: colors.success, cursor: "pointer" }}
              />
              <span style={{ fontSize: 14, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>
                {a.name}
              </span>
              {a.email && (
                <span style={{ fontSize: 12, color: colors.textTertiary }}>({a.email})</span>
              )}
              <div style={{ marginLeft: "auto" }}>
                {a.auditEnabled ? (
                  <Badge color={colors.success} dot size="sm">Audit On</Badge>
                ) : (
                  <Badge color={colors.textMuted} size="sm">Skipped</Badge>
                )}
              </div>
            </label>
          ))}
          {agents.filter((a) => a.active !== false).length === 0 && (
            <p style={{ color: colors.textMuted, fontSize: 13, padding: "12px 0" }}>No active agents found.</p>
          )}
        </div>
      </div>

      {/* Call Duration Filter */}
      <div className="animate-fade-in-up stagger-3" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>Call Duration Filter</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Only audit calls within this duration range. Set to 0 to disable a limit.
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={LBL}>Min Seconds</label>
            <input
              className="input-focus"
              style={{ ...baseInputStyle, boxSizing: "border-box", width: 140 }}
              type="number"
              min="0"
              value={auditMinSec}
              onChange={(e) => setAuditMinSec(Number(e.target.value))}
              disabled={!auditDurationLoaded}
            />
          </div>
          <div>
            <label style={LBL}>Max Seconds</label>
            <input
              className="input-focus"
              style={{ ...baseInputStyle, boxSizing: "border-box", width: 140 }}
              type="number"
              min="0"
              value={auditMaxSec}
              onChange={(e) => setAuditMaxSec(Number(e.target.value))}
              disabled={!auditDurationLoaded}
            />
          </div>
          <Button variant="success" icon={<Save size={14} />} loading={savingDuration} onClick={handleSaveDuration}>
            Save Filter
          </Button>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="animate-fade-in-up stagger-4" style={CARD}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>Webhook Configuration</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Configure Convoso to POST to this endpoint after each call.
          </p>
        </div>
        <div
          style={{
            background: colors.bgSurfaceInset,
            borderRadius: radius.lg,
            padding: "14px 16px",
            fontFamily: typography.fontMono,
            fontSize: 13,
            color: colors.success,
            wordBreak: "break-all",
            border: `1px solid ${colors.borderSubtle}`,
            marginBottom: 16,
          }}
        >
          POST {API || "https://your-api-domain.com"}/api/webhooks/convoso
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "8px 12px",
            fontSize: 13,
            lineHeight: 1.6,
            color: colors.textSecondary,
          }}
        >
          <span style={{ fontWeight: typography.weights.semibold, color: colors.textTertiary, whiteSpace: "nowrap" }}>Header:</span>
          <code style={{ fontFamily: typography.fontMono, fontSize: 12, color: colors.primary300 }}>
            x-webhook-secret: your-secret
          </code>
          <span style={{ fontWeight: typography.weights.semibold, color: colors.textTertiary, whiteSpace: "nowrap" }}>Body:</span>
          <code style={{ fontFamily: typography.fontMono, fontSize: 12, color: colors.primary300, wordBreak: "break-all" }}>
            {`{ "agent_user": "crm-user-id", "list_id": "crm-list-id", "recording_url": "https://...", "call_timestamp": "ISO-8601", "call_duration_seconds": 120 }`}
          </code>
        </div>
      </div>

      {/* AI Scoring & Cost Controls */}
      <div className="animate-fade-in-up stagger-5" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>AI Scoring & Cost Controls</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Monitor AI usage, set budget caps, and trigger batch scoring of eligible calls.
          </p>
        </div>

        {/* Usage Stats */}
        {aiStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Today's Spend</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
                {formatDollar(aiStats.todaySpent)}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                of {formatDollar(aiStats.dailyBudget)} budget
              </div>
            </div>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Calls Scored Today</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
                {aiStats.todayCount}
              </div>
            </div>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Queued</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: aiStats.queuedCount > 0 ? colors.warning : colors.textPrimary }}>
                {aiStats.queuedCount}
              </div>
            </div>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Est. Monthly</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
                {formatDollar(aiStats.estimatedMonthly)}
              </div>
            </div>
          </div>
        )}

        {/* Budget Control */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <label style={LBL}>Daily Budget Cap ($)</label>
            <input
              className="input-focus"
              style={{ ...INP, width: 160 }}
              type="number"
              min="0"
              max="1000"
              step="0.50"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
          </div>
          <Button variant="success" icon={<Save size={14} />} loading={savingBudget} onClick={handleSaveBudget}>
            Update Budget
          </Button>
        </div>

        {/* Auto-Score Trigger */}
        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 16 }}>
          <p style={{ ...SECTION_SUBTITLE, marginBottom: 12 }}>
            Queue all eligible calls (2+ min with recording, not yet scored) for AI analysis.
          </p>
          <Button variant="primary" loading={autoScoring} onClick={handleAutoScore}>
            Score Eligible Calls
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Agent KPI Table ────────────────────────────────────────────── */

function AgentKPITable({ kpiData }: { kpiData: KpiData | null }) {
  const [sortCol, setSortCol] = useState<keyof AgentKpi>("chargebackTotal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: keyof AgentKpi) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = kpiData
    ? [...kpiData.agents].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      })
    : [];

  const SortIcon = ({ col }: { col: keyof AgentKpi }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  if (!kpiData) {
    return (
      <div style={{ ...CARD, padding: 24 }}>
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  return (
    <>
      {/* Summary stat cards */}
      <div
        className="grid-mobile-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}
      >
        <StatCard
          label="Total Chargebacks"
          value={kpiData.totals.totalChargebackCount}
          icon={<AlertTriangle size={18} />}
          accent={colors.danger}
          style={{ borderTop: `3px solid ${colors.danger}` }}
        />
        <StatCard
          label="Chargeback Total"
          value={formatDollar(kpiData.totals.totalChargebackDollars)}
          icon={<DollarSign size={18} />}
          accent={colors.warning ?? "#eab308"}
          style={{ borderTop: `3px solid ${colors.warning ?? "#eab308"}` }}
        />
        <StatCard
          label="Pending Terms"
          value={kpiData.totals.totalPendingTermCount}
          icon={<Clock size={18} />}
          accent={colors.accentTeal}
          style={{ borderTop: `3px solid ${colors.accentTeal}` }}
        />
      </div>

      {/* Agent KPI table */}
      <div className="animate-fade-in-up stagger-2" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={16} color={colors.textTertiary} />
          <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
            Agent Retention KPIs (30-day window)
          </span>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<Activity size={32} />}
            title="No KPI data yet"
            description="Agent chargeback and pending term metrics from the last 30 days will appear here."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.bgSurfaceInset }}>
                  <th
                    style={{ ...baseThStyle, cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleSort("agentName")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Agent Name <SortIcon col="agentName" /></span>
                  </th>
                  <th
                    style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                    onClick={() => toggleSort("chargebackCount")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Chargebacks <SortIcon col="chargebackCount" /></span>
                  </th>
                  <th
                    style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                    onClick={() => toggleSort("chargebackTotal")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Chargeback Total <SortIcon col="chargebackTotal" /></span>
                  </th>
                  <th
                    style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                    onClick={() => toggleSort("pendingTermCount")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Pending Terms <SortIcon col="pendingTermCount" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((agent) => (
                  <tr key={agent.agentId} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                    <td style={{ ...baseTdStyle, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>{agent.agentName}</td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: agent.chargebackCount > 0 ? colors.danger : colors.textSecondary }}>
                      {agent.chargebackCount}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: agent.chargebackTotal > 0 ? colors.danger : colors.textSecondary }}>
                      {formatDollar(agent.chargebackTotal)}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: agent.pendingTermCount > 0 ? (colors.warning ?? "#eab308") : colors.textSecondary }}>
                      {agent.pendingTermCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Permission Table ──────────────────────────────────────────── */

function PermissionTable({
  permData,
  onSavePermissions,
}: {
  permData: PermData | null;
  onSavePermissions: (overrides: { userId: string; permission: string; granted: boolean }[]) => Promise<void>;
}) {
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!permData) {
    return (
      <div style={{ ...CARD, padding: 24, marginTop: 24 }}>
        <SkeletonTable rows={5} columns={8} />
      </div>
    );
  }

  const hasChanges = Object.keys(changes).length > 0;

  const handleToggle = (userId: string, perm: string, currentGranted: boolean) => {
    setChanges((prev) => {
      const userChanges = { ...(prev[userId] || {}) };
      const newValue = !currentGranted;
      // If toggling back to original, remove from changes
      const original = permData.users.find((u) => u.id === userId)?.permissions[perm]?.granted;
      if (newValue === original) {
        delete userChanges[perm];
        if (Object.keys(userChanges).length === 0) {
          const next = { ...prev };
          delete next[userId];
          return next;
        }
      } else {
        userChanges[perm] = newValue;
      }
      return { ...prev, [userId]: userChanges };
    });
  };

  const handleSave = async () => {
    const overrides: { userId: string; permission: string; granted: boolean }[] = [];
    for (const [userId, perms] of Object.entries(changes)) {
      for (const [perm, granted] of Object.entries(perms)) {
        overrides.push({ userId, permission: perm, granted });
      }
    }
    if (overrides.length === 0) return;

    setSaving(true);
    try {
      await onSavePermissions(overrides);
      setChanges({});
      toast("success", `Updated ${overrides.length} permission${overrides.length !== 1 ? "s" : ""}`);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...CARD, padding: 0, overflow: "hidden", marginTop: 24 }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={16} color={colors.textTertiary} />
          <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
            Permission Management
          </span>
        </div>
        {hasChanges && (
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            loading={saving}
            onClick={handleSave}
          >
            Save Permissions
          </Button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: colors.bgSurfaceInset }}>
              <th style={baseThStyle}>User</th>
              {permData.configurablePermissions.map((p) => (
                <th key={p} style={{ ...baseThStyle, textAlign: "center", fontSize: 11, padding: "10px 6px" }}>
                  {PERM_LABELS[p] ?? p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Hard-coded locked rows */}
            <tr style={{ background: `${colors.bgSurfaceInset}60` }}>
              <td style={{ ...baseTdStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={12} color={colors.textMuted} />
                <span style={{ color: colors.textMuted, fontSize: 13 }}>Payroll Access</span>
              </td>
              {permData.configurablePermissions.map((p) => (
                <td key={p} style={{ ...baseTdStyle, textAlign: "center" }}>
                  <input type="checkbox" checked={false} disabled title="SUPER_ADMIN only" style={{ opacity: 0.3 }} />
                </td>
              ))}
            </tr>
            <tr style={{ background: `${colors.bgSurfaceInset}60` }}>
              <td style={{ ...baseTdStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={12} color={colors.textMuted} />
                <span style={{ color: colors.textMuted, fontSize: 13 }}>User Creation</span>
              </td>
              {permData.configurablePermissions.map((p) => (
                <td key={p} style={{ ...baseTdStyle, textAlign: "center" }}>
                  <input type="checkbox" checked={false} disabled title="SUPER_ADMIN only" style={{ opacity: 0.3 }} />
                </td>
              ))}
            </tr>

            {/* User permission rows */}
            {permData.users.map((user) => (
              <tr key={user.id} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                <td style={baseTdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: typography.weights.semibold, color: colors.textPrimary, fontSize: 13 }}>{user.name}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {user.roles.map((r) => (
                        <Badge key={r} color={ROLE_COLORS[r] ?? colors.textTertiary} size="sm">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </td>
                {permData.configurablePermissions.map((perm) => {
                  const userPerm = user.permissions[perm];
                  const currentGranted = changes[user.id]?.[perm] ?? userPerm?.granted ?? false;
                  const isOverrideOrChanged = userPerm?.isOverride || (changes[user.id] && perm in changes[user.id]);

                  return (
                    <td key={perm} style={{ ...baseTdStyle, textAlign: "center", position: "relative" }}>
                      <input
                        type="checkbox"
                        checked={currentGranted}
                        onChange={() => handleToggle(user.id, perm, currentGranted)}
                        style={{ accentColor: colors.accentTeal, width: 15, height: 15, cursor: "pointer" }}
                      />
                      {isOverrideOrChanged && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: colors.accentTeal,
                          }}
                          title="Custom override"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Users section ──────────────────────────────────────────────── */

function UsersSection({
  users,
  usersLoaded,
  onSave,
  onDelete,
}: {
  users: User[];
  usersLoaded: boolean;
  onSave: (id: string, data: Partial<User> & { password?: string }) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", roles: ["MANAGER"] as string[] });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>User Management</h2>
          <p style={SECTION_SUBTITLE}>Manage platform access and role assignments</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<UserPlus size={14} />}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Cancel" : "New User"}
        </Button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <div
          className="animate-slide-down"
          style={{ ...CARD, marginBottom: 24, borderTop: `3px solid ${colors.primary500}` }}
        >
          <h3 style={{ ...SECTION_TITLE, marginBottom: 20 }}>Create New User</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              try {
                const res = await authFetch(`${API}/api/users`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(newUser),
                });
                if (res.ok) {
                  toast("success", `User "${newUser.name}" created successfully`);
                  setNewUser({ name: "", email: "", password: "", roles: ["MANAGER"] });
                  setShowCreate(false);
                } else {
                  const err = await res.json().catch(() => ({}));
                  toast("error", err.error ?? `Request failed (${res.status})`);
                }
              } catch (e: unknown) {
                toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
              } finally {
                setCreating(false);
              }
            }}
          >
            <div
              className="stack-mobile"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}
            >
              <div>
                <label style={LBL}>Full Name</label>
                <input
                  className="input-focus"
                  style={{ ...baseInputStyle, boxSizing: "border-box" }}
                  required
                  placeholder="Jane Smith"
                  value={newUser.name}
                  onChange={(e) => setNewUser((x) => ({ ...x, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Email Address</label>
                <input
                  className="input-focus"
                  style={{ ...baseInputStyle, boxSizing: "border-box" }}
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser((x) => ({ ...x, email: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Password (min 8)</label>
                <input
                  className="input-focus"
                  style={{ ...baseInputStyle, boxSizing: "border-box" }}
                  type="password"
                  required
                  minLength={8}
                  placeholder="Secure password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((x) => ({ ...x, password: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={LBL}>Roles</label>
              <RoleCheckboxes selected={newUser.roles} onChange={(roles) => setNewUser((x) => ({ ...x, roles }))} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                type="submit"
                variant="primary"
                icon={<Check size={14} />}
                loading={creating}
                disabled={creating || newUser.roles.length === 0}
              >
                Create User
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="animate-fade-in-up stagger-2" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={16} color={colors.textTertiary} />
          <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
            {usersLoaded ? `${users.length} user${users.length !== 1 ? "s" : ""}` : "Loading..."}
          </span>
        </div>

        {!usersLoaded ? (
          <div style={{ padding: 24 }}>
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.bgSurfaceInset }}>
                  <th style={baseThStyle}>Name</th>
                  <th style={baseThStyle}>Email</th>
                  <th style={baseThStyle}>Roles</th>
                  <th style={baseThStyle}>Status</th>
                  <th style={{ ...baseThStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={<Users size={32} />}
                        title="No users found"
                        description="Create a new user to get started."
                        action={{ label: "Create User", onClick: () => setShowCreate(true) }}
                      />
                    </td>
                  </tr>
                ) : (
                  users.map((u) => <UserRow key={u.id} user={u} onSave={onSave} onDelete={onDelete} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Loading skeleton ───────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} height={120} />
        ))}
      </div>
      <SkeletonCard height={400} />
    </>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

function OwnerDashboardInner() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [range, setRange] = useState<Range>("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Period summary state
  const [periodView, setPeriodView] = useState<"weekly" | "monthly">("weekly");
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);

  // Storage, KPI, and permission state
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [storageAlertDismissed, setStorageAlertDismissed] = useState(false);
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [kpiLoaded, setKpiLoaded] = useState(false);
  const [permData, setPermData] = useState<PermData | null>(null);
  const [permLoaded, setPermLoaded] = useState(false);

  // AI Prompts state
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptLoaded, setAiPromptLoaded] = useState(false);
  const [auditMinSec, setAuditMinSec] = useState(0);
  const [auditMaxSec, setAuditMaxSec] = useState(0);
  const [auditDurationLoaded, setAuditDurationLoaded] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    captureTokenFromUrl();
    try {
      const token = localStorage.getItem("ops_session_token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload?.roles?.includes("SUPER_ADMIN")) setIsSuperAdmin(true);
      }
    } catch { /* ignore */ }

    // Fetch storage stats on mount
    authFetch(`${API}/api/storage-stats`).then((r) => r.ok ? r.json() : null).then(setStorageStats).catch(() => {});

    // Load AI audit system prompt on mount so it is always available in the editor
    authFetch(`${API}/api/settings/ai-audit-prompt`)
      .then((r) => r.ok ? r.json() : { prompt: "" })
      .then((d) => { setAiPrompt(d.prompt); setAiPromptLoaded(true); })
      .catch(() => { setAiPromptLoaded(true); });
  }, []);

  const fetchData = useCallback((r: Range) => {
    setLoading(true);
    Promise.all([
      authFetch(`${API}/api/owner/summary?range=${r}`).then((res) => res.ok ? res.json() : null).catch(() => null),
      authFetch(`${API}/api/tracker/summary?range=${r}`).then((res) => res.ok ? res.json() : []).catch(() => []),
      authFetch(`${API}/api/session/me`).then((res) => res.ok ? res.json() : null).catch(() => null),
      authFetch(`${API}/api/reporting/periods?view=${periodView}`).then(res => res.ok ? res.json() : { periods: [] }).catch(() => ({ periods: [] })),
    ]).then(([s, t, me, periodData]) => {
      setSummary(s);
      setTracker(t);
      setPeriods(periodData.periods ?? []);
      if (me?.roles?.includes("SUPER_ADMIN")) setIsSuperAdmin(true);
      setLoading(false);
    });
  }, [periodView]);

  useEffect(() => { fetchData(range); }, [range, fetchData]);

  useEffect(() => {
    authFetch(`${API}/api/reporting/periods?view=${periodView}`)
      .then(res => res.ok ? res.json() : { periods: [] })
      .then(data => setPeriods(data.periods ?? []))
      .catch(() => {});
  }, [periodView]);

  // Socket.IO: real-time KPI patching
  const [highlightedCards, setHighlightedCards] = useState<Set<string>>(new Set());
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const highlightCard = (cardKey: string) => {
    setHighlightedCards(prev => new Set(prev).add(cardKey));
    setTimeout(() => {
      setHighlightedCards(prev => { const next = new Set(prev); next.delete(cardKey); return next; });
    }, 100);
  };

  const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
    // Only RAN sales affect KPIs
    if (payload.sale.status !== "RAN") return;
    // Only cascade on created / status_changed
    if (payload.type !== "created" && payload.type !== "status_changed") return;

    // Highlight the KPI cards that will change
    highlightCard("salesCount");
    highlightCard("premiumTotal");

    // Patch summary state directly -- NO API refetch
    setSummary(prev => prev ? {
      ...prev,
      salesCount: (prev.salesCount || 0) + 1,
      premiumTotal: (prev.premiumTotal || 0) + payload.sale.premium,
    } : prev);

    // Also patch the tracker if the agent is in the current view
    setTracker(prev => {
      const agentName = payload.sale.agent.name;
      const existing = prev.find(t => t.agent === agentName);
      if (existing) {
        return prev.map(t => t.agent === agentName ? {
          ...t,
          salesCount: t.salesCount + 1,
          premiumTotal: t.premiumTotal + payload.sale.premium,
        } : t);
      }
      // New agent -- add to tracker
      return [...prev, {
        agent: agentName,
        salesCount: 1,
        premiumTotal: payload.sale.premium,
        totalLeadCost: 0,
        costPerSale: 0,
        commissionTotal: 0,
      }];
    });
  }, []);

  const { disconnected } = useSocket(API, handleSaleChanged, () => fetchData(rangeRef.current));

  useEffect(() => {
    if (activeSection === "config" && !agentsLoaded) {
      authFetch(`${API}/api/agents`).then((r) => r.ok ? r.json() : []).then(setAgents).catch(() => {});
      setAgentsLoaded(true);
    }
    if (activeSection === "config" && !auditDurationLoaded) {
      authFetch(`${API}/api/settings/audit-duration`).then((r) => r.ok ? r.json() : { minSeconds: 0, maxSeconds: 0 }).then((d) => { setAuditMinSec(d.minSeconds); setAuditMaxSec(d.maxSeconds); }).catch(() => {});
      setAuditDurationLoaded(true);
    }
    if (activeSection === "users" && !usersLoaded && isSuperAdmin) {
      authFetch(`${API}/api/users`)
        .then((r) => r.ok ? r.json() : [])
        .then((u) => { setUsers(u); setUsersLoaded(true); })
        .catch(() => { setUsers([]); setUsersLoaded(true); });
    }
    if (activeSection === "users" && !permLoaded && isSuperAdmin) {
      authFetch(`${API}/api/permissions`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { setPermData(d); setPermLoaded(true); })
        .catch(() => { setPermLoaded(true); });
    }
    if (activeSection === "kpis" && !kpiLoaded) {
      authFetch(`${API}/api/agent-kpis`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { setKpiData(d); setKpiLoaded(true); })
        .catch(() => { setKpiLoaded(true); });
    }
  }, [activeSection, isSuperAdmin, agentsLoaded, auditDurationLoaded, usersLoaded, permLoaded, kpiLoaded]);

  async function saveUser(id: string, data: Partial<User> & { password?: string }): Promise<string | null> {
    try {
      const res = await authFetch(`${API}/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const u = await res.json();
        setUsers((prev) => prev.map((x) => (x.id === id ? u : x)));
        return null;
      }
      const err = await res.json().catch(() => ({}));
      return err.error ?? "Failed to save";
    } catch (e: unknown) {
      return `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`;
    }
  }

  async function deleteUser(id: string): Promise<string | null> {
    try {
      const res = await authFetch(`${API}/api/users/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setUsers((prev) => prev.filter((x) => x.id !== id));
        toast("success", "User deleted");
        return null;
      }
      const err = await res.json().catch(() => ({}));
      return err.error ?? "Failed to delete user";
    } catch (e: unknown) {
      return `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`;
    }
  }

  async function savePermissions(overrides: { userId: string; permission: string; granted: boolean }[]): Promise<void> {
    const res = await authFetch(`${API}/api/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Request failed (${res.status})`);
    }
    // Re-fetch permission data
    const fresh = await authFetch(`${API}/api/permissions`).then((r) => r.ok ? r.json() : null);
    if (fresh) setPermData(fresh);
  }

  const navItems = isSuperAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_BASE;

  const subtitleMap: Record<ActiveSection, string> = {
    dashboard: "Performance overview and agent leaderboard",
    kpis: "Agent retention metrics and chargeback tracking",
    config: "AI audit settings and webhook configuration",
    users: "Platform users and role management",
  };

  return (
    <PageShell
      title="Owner Dashboard"
      subtitle={subtitleMap[activeSection]}
      navItems={navItems}
      activeNav={activeSection}
      onNavChange={(key) => setActiveSection(key as ActiveSection)}
    >
      {disconnected && <div style={DISCONNECT_BANNER}>Connection lost. Reconnecting...</div>}

      {/* Storage Alert Banner */}
      {storageStats?.alertActive && !storageAlertDismissed && (
        <div style={STORAGE_ALERT}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <Database size={18} color={colors.warning ?? "#eab308"} />
            <span style={{ fontSize: 13, color: colors.textPrimary }}>
              Database storage at {storageStats.usagePct}% capacity ({storageStats.dbSizeMB} MB / {storageStats.planLimitMB} MB)
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" onClick={() => setActiveSection("config")}>
              Manage Data
            </Button>
            <button
              aria-label="Dismiss storage alert"
              onClick={() => setStorageAlertDismissed(true)}
              style={{
                background: "transparent",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {activeSection === "dashboard" && (
        <div className="animate-fade-in">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <DashboardSection
              summary={summary}
              tracker={tracker}
              range={range}
              onRangeChange={(r) => setRange(r)}
              highlightedCards={highlightedCards}
              periods={periods}
              periodView={periodView}
              onPeriodViewChange={setPeriodView}
            />
          )}
        </div>
      )}

      {activeSection === "kpis" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>Agent Retention KPIs</h2>
              <p style={SECTION_SUBTITLE}>Per-agent chargeback and pending term metrics (30-day rolling window)</p>
            </div>
          </div>
          <AgentKPITable kpiData={kpiData} />
        </div>
      )}

      {activeSection === "config" && (
        <div className="animate-fade-in">
          <ConfigSection
            agents={agents}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            aiPromptLoaded={aiPromptLoaded}
            auditMinSec={auditMinSec}
            setAuditMinSec={setAuditMinSec}
            auditMaxSec={auditMaxSec}
            setAuditMaxSec={setAuditMaxSec}
            auditDurationLoaded={auditDurationLoaded}
            setAgents={setAgents}
          />
        </div>
      )}

      {activeSection === "users" && isSuperAdmin && (
        <div className="animate-fade-in">
          <UsersSection
            users={users}
            usersLoaded={usersLoaded}
            onSave={saveUser}
            onDelete={deleteUser}
          />
          <PermissionTable permData={permData} onSavePermissions={savePermissions} />
        </div>
      )}
    </PageShell>
  );
}

/* ── Root export (wraps with ToastProvider) ─────────────────────── */

export default function OwnerDashboard() {
  return (
    <ToastProvider>
      <OwnerDashboardInner />
    </ToastProvider>
  );
}
