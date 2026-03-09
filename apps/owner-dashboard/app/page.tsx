import { PageShell } from "@ops/ui";

export default function OwnerDashboard() {
  return (
    <PageShell title="Owner Dashboard">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {['Total Sales','Premium Total','Payroll Total','Clawbacks'].map((k) => <div key={k} style={{ border:'1px solid #ddd', padding:12 }}>{k}</div>)}
      </div>
      <p>Includes recent sales, clawbacks, audits, and open payroll periods.</p>
    </PageShell>
  );
}
