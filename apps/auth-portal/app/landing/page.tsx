export default function Landing() {
  return (
    <main>
      <h1>Super Admin Landing</h1>
      <ul>
        <li><a href={process.env.MANAGER_DASHBOARD_URL}>Manager Dashboard</a></li>
        <li><a href={process.env.PAYROLL_DASHBOARD_URL}>Payroll Dashboard</a></li>
        <li><a href={process.env.OWNER_DASHBOARD_URL}>Owner Dashboard</a></li>
      </ul>
    </main>
  );
}
