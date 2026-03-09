import { PageShell } from "@ops/ui";

const tabs = ["Payroll Weeks", "Payout Config", "Payroll Config", "Clawbacks", "Exports"];

export default function PayrollDashboard() {
  return (
    <PageShell title="Payroll Dashboard">
      <nav>{tabs.map((t) => <button key={t} style={{ marginRight: 8 }}>{t}</button>)}</nav>
      <p>Weekly payroll cards, payout config CRUD, payroll settings, clawback matching/processing, CSV exports.</p>
    </PageShell>
  );
}
