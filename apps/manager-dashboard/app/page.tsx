import { PageShell } from "@ops/ui";

const tabs = ["Sales Entry", "Agent CPA / Sales Tracker", "Call Audits", "General Config"];

export default function ManagerDashboard() {
  return (
    <PageShell title="Manager Dashboard">
      <nav>{tabs.map((t) => <button key={t} style={{ marginRight: 8 }}>{t}</button>)}</nav>
      <section>
        <h2>Sales Entry</h2>
        <p>Form fields: agent, sale date, member, carrier, product, premium, effective date, lead source, status, notes.</p>
      </section>
      <section><h2>Agent Tracker</h2><p>Weekly/monthly sales, lead spend, CPA/CPS, premium totals, ranking, trends.</p></section>
      <section><h2>Call Audits</h2><p>CRUD filters for score, status, coaching notes, reviewer.</p></section>
      <section><h2>General Config</h2><p>Manage agents, lead sources, product labels.</p></section>
    </PageShell>
  );
}
