"use client";
import { useState, useEffect, useCallback } from "react";
import { PageShell, SkeletonCard, ToastProvider } from "@ops/ui";
import type { NavItem } from "@ops/ui";
import { spacing } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { useSocketContext } from "@/lib/SocketProvider";
import type { SaleChangedPayload } from "@ops/socket";
import { DISCONNECT_BANNER } from "@ops/socket";
import {
  Calendar, AlertTriangle, FileDown, Package, Users,
} from "lucide-react";

import PayrollPeriods from "./PayrollPeriods";
import PayrollChargebacks from "./PayrollChargebacks";
import PayrollExports from "./PayrollExports";
import PayrollProducts from "./PayrollProducts";
import PayrollService from "./PayrollService";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

/* ── Types (shared across sub-tabs) ──────────────────────────── */

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
type BonusCategory = { name: string; isDeduction: boolean };
type ServiceEntry = {
  id: string; basePay: number; bonusAmount: number; deductionAmount: number;
  frontedAmount?: number; totalPay: number; bonusBreakdown?: Record<string, number>;
  status: string; notes?: string; serviceAgent: { name: string; basePay: number };
};
type Period = {
  id: string; weekStart: string; weekEnd: string; quarterLabel: string;
  status: string; entries: Entry[]; serviceEntries: ServiceEntry[];
};
type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = {
  id: string; name: string; active: boolean; type: ProductType;
  premiumThreshold?: number | null; commissionBelow?: number | null;
  commissionAbove?: number | null; bundledCommission?: number | null;
  standaloneCommission?: number | null; enrollFeeThreshold?: number | null;
  notes?: string;
};
type ServiceAgent = { id: string; name: string; basePay: number; active: boolean };
type StatusChangeRequest = {
  id: string;
  saleId: string;
  oldStatus: string;
  newStatus: string;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};
type SaleEditRequest = {
  id: string;
  saleId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};

type Alert = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  customerName: string | null;
  amount: number | null;
  createdAt: string;
};

type Tab = "periods" | "chargebacks" | "exports" | "products" | "service";

/* ── Nav items ───────────────────────────────────────────────── */

const NAV_ITEMS: NavItem[] = [
  { icon: <Calendar size={18} />,       label: "Periods",          key: "periods" },
  { icon: <AlertTriangle size={18} />,  label: "Chargebacks",      key: "chargebacks" },
  { icon: <FileDown size={18} />,       label: "Exports",          key: "exports" },
  { icon: <Package size={18} />,        label: "Products",         key: "products" },
  { icon: <Users size={18} />,          label: "Customer Service", key: "service" },
];

/* ── Loading skeleton ────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: spacing[4] }}>
      {[1, 2, 3].map(i => <SkeletonCard key={i} height={140} />)}
    </div>
  );
}

/* ── Orchestrator inner (needs toast context) ───────────────── */

function PayrollInner() {
  const { socket, disconnected } = useSocketContext();
  const [tab, setTab] = useState<Tab>("periods");

  /* ── Shared state ─────────────────────────────────────────── */
  const [periods, setPeriods] = useState<Period[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceAgents, setServiceAgents] = useState<ServiceAgent[]>([]);
  const [bonusCategories, setBonusCategories] = useState<BonusCategory[]>([]);
  const [allAgents, setAllAgents] = useState<{ id: string; name: string }[]>([]);
  const [pendingRequests, setPendingRequests] = useState<StatusChangeRequest[]>([]);
  const [pendingEditRequests, setPendingEditRequests] = useState<SaleEditRequest[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [highlightedAlertIds, setHighlightedAlertIds] = useState<Set<string>>(new Set());

  /* ── Shared data fetchers ─────────────────────────────────── */

  const refreshPeriods = useCallback(async () => {
    const p = await authFetch(`${API}/api/payroll/periods`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);
    setPeriods(p);
  }, []);

  const fetchAlerts = useCallback(() => {
    authFetch(`${API}/api/alerts`).then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setAlerts(data);
    }).catch(() => {});
  }, []);

  /* ── Socket event handling ────────────────────────────────── */

  const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
    if (payload.type !== "created" && payload.type !== "status_changed") return;

    const matchingEntries = payload.payrollEntries;
    if (matchingEntries.length === 0) return;

    setPeriods(prev => prev.map(period => {
      const periodEntries = matchingEntries.filter(e => e.periodId === period.id);
      if (periodEntries.length === 0) return period;

      const updatedEntries = [...period.entries];
      for (const pe of periodEntries) {
        const existingIdx = updatedEntries.findIndex(e => e.id === pe.id);
        const newEntry: Entry = {
          id: pe.id,
          payoutAmount: pe.payoutAmount,
          adjustmentAmount: pe.adjustmentAmount,
          bonusAmount: pe.bonusAmount,
          frontedAmount: pe.frontedAmount,
          holdAmount: pe.holdAmount,
          netAmount: pe.netAmount,
          status: pe.status,
          sale: {
            id: payload.sale.id,
            memberName: payload.sale.memberName,
            memberId: payload.sale.memberId,
            carrier: payload.sale.carrier,
            premium: payload.sale.premium,
            enrollmentFee: payload.sale.enrollmentFee,
            commissionApproved: false,
            status: payload.sale.status,
            product: payload.sale.product,
            addons: payload.sale.addons?.map((a) => ({ productId: a.product?.id ?? "", premium: (a as { premium?: number | null }).premium ?? null, product: a.product })),
          },
          agent: { name: payload.sale.agent.name },
        };
        if (existingIdx >= 0) {
          updatedEntries[existingIdx] = newEntry;
        } else {
          updatedEntries.push(newEntry);
        }
      }
      return { ...period, entries: updatedEntries };
    }));
  }, []);

  // Subscribe to socket events
  useEffect(() => {
    if (!socket) return;

    const onSaleChanged = (payload: SaleChangedPayload) => handleSaleChanged(payload);
    const onReconnect = () => { refreshPeriods(); fetchAlerts(); };
    const onAlertCreated = (data: { alertId?: string }) => {
      fetchAlerts();
      if (data?.alertId) {
        setHighlightedAlertIds(prev => new Set(prev).add(data.alertId));
        setTimeout(() => {
          setHighlightedAlertIds(prev => { const next = new Set(prev); next.delete(data.alertId); return next; });
        }, 100);
      }
    };
    const onAlertResolved = (data: { alertId: string }) => {
      setAlerts(prev => prev.filter(a => a.id !== data.alertId));
    };

    socket.on("sale:changed", onSaleChanged);
    socket.on("connect", onReconnect);
    socket.on("alert:created", onAlertCreated);
    socket.on("alert:resolved", onAlertResolved);

    return () => {
      socket.off("sale:changed", onSaleChanged);
      socket.off("connect", onReconnect);
      socket.off("alert:created", onAlertCreated);
      socket.off("alert:resolved", onAlertResolved);
    };
  }, [socket, handleSaleChanged, refreshPeriods, fetchAlerts]);

  /* ── Initial data load ────────────────────────────────────── */

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products?all=true`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/service-agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/settings/service-bonus-categories`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/status-change-requests?status=PENDING`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/sale-edit-requests?status=PENDING`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/alerts`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, prod, sa, cats, agents, scr, editReqs, alertsData]) => {
      setPeriods(p);
      setProducts(prod);
      setServiceAgents(sa);
      setBonusCategories(cats);
      setAllAgents(agents);
      setPendingRequests(scr);
      setPendingEditRequests(editReqs);
      if (Array.isArray(alertsData)) setAlerts(alertsData);
      setLoadingAlerts(false);
      setLoading(false);
    });
  }, []);

  /* ── Pending approval badge count for Periods nav ── */
  const totalNeedingApproval = periods.reduce((sum, p) =>
    sum + p.entries.filter(e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved).length, 0
  );

  const navItemsWithBadges = NAV_ITEMS.map(item =>
    item.key === "periods" && totalNeedingApproval > 0
      ? { ...item, badge: totalNeedingApproval }
      : item
  );

  if (loading) {
    return (
      <PageShell
        compact
        title="Payroll Dashboard"
        subtitle="Loading data..."
        navItems={NAV_ITEMS}
        activeNav={tab}
        onNavChange={key => setTab(key as Tab)}
      >
        <LoadingSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      compact
      title="Payroll Dashboard"
      subtitle="Commission, payroll periods & service management"
      navItems={navItemsWithBadges}
      activeNav={tab}
      onNavChange={key => setTab(key as Tab)}
    >
      {disconnected && <div style={DISCONNECT_BANNER}>Connection lost. Reconnecting...</div>}

      {tab === "periods" && (
        <PayrollPeriods
          socket={socket}
          API={API}
          periods={periods}
          setPeriods={setPeriods}
          products={products}
          allAgents={allAgents}
          bonusCategories={bonusCategories}
          pendingRequests={pendingRequests}
          setPendingRequests={setPendingRequests}
          pendingEditRequests={pendingEditRequests}
          setPendingEditRequests={setPendingEditRequests}
          alerts={alerts}
          setAlerts={setAlerts}
          loadingAlerts={loadingAlerts}
          highlightedAlertIds={highlightedAlertIds}
          refreshPeriods={refreshPeriods}
        />
      )}

      {tab === "chargebacks" && (
        <PayrollChargebacks API={API} />
      )}

      {tab === "exports" && (
        <PayrollExports API={API} periods={periods} />
      )}

      {tab === "products" && (
        <PayrollProducts API={API} products={products} setProducts={setProducts} />
      )}

      {tab === "service" && (
        <PayrollService
          API={API}
          periods={periods}
          serviceAgents={serviceAgents}
          setServiceAgents={setServiceAgents}
          bonusCategories={bonusCategories}
          setBonusCategories={setBonusCategories}
          refreshPeriods={refreshPeriods}
        />
      )}
    </PageShell>
  );
}

/* ── Main page (wraps with ToastProvider) ───────────────────── */

export default function PayrollPage() {
  return (
    <ToastProvider>
      <PayrollInner />
    </ToastProvider>
  );
}
