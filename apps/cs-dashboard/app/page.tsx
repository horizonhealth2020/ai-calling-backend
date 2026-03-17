"use client";
import { useState, useEffect } from "react";
import { PageShell, Card, EmptyState, spacing, colors } from "@ops/ui";
import { captureTokenFromUrl } from "@ops/auth/client";
import { ClipboardList, BarChart3 } from "lucide-react";

type Tab = "submissions" | "tracking";

export default function CSDashboard() {
  const [tab, setTab] = useState<Tab>("submissions");

  useEffect(() => { captureTokenFromUrl(); }, []);

  const navItems = [
    { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
    { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
  ];

  return (
    <PageShell
      title="Customer Service"
      subtitle="Chargebacks & Pending Terms"
      navItems={navItems}
      activeNav={tab}
      onNavChange={(k) => setTab(k as Tab)}
    >
      {tab === "submissions" && <SubmissionsTab />}
      {tab === "tracking" && <TrackingTab />}
    </PageShell>
  );
}

const SECTION_HEADING: React.CSSProperties = {
  margin: `0 0 ${spacing[4]}px`,
  fontSize: 16,
  fontWeight: 600,
  color: colors.textPrimary,
};

function SubmissionsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${spacing[6]}px` }}>
      <Card>
        <h3 style={SECTION_HEADING}>Chargeback Submissions</h3>
        <EmptyState
          title="Paste Chargeback Data"
          description="Paste raw chargeback text here to parse and submit records. This feature is coming in the next update."
        />
      </Card>
      <Card>
        <h3 style={SECTION_HEADING}>Pending Terms Submissions</h3>
        <EmptyState
          title="Paste Pending Terms Data"
          description="Paste raw pending terms text here to parse and submit records. This feature is coming in the next update."
        />
      </Card>
    </div>
  );
}

function TrackingTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${spacing[6]}px` }}>
      <Card>
        <h3 style={SECTION_HEADING}>Chargeback Tracking</h3>
        <EmptyState
          title="No Chargebacks Yet"
          description="Chargeback records will appear here once submissions are processed."
        />
      </Card>
      <Card>
        <h3 style={SECTION_HEADING}>Pending Terms Tracking</h3>
        <EmptyState
          title="No Pending Terms Yet"
          description="Pending terms records will appear here once submissions are processed."
        />
      </Card>
    </div>
  );
}
