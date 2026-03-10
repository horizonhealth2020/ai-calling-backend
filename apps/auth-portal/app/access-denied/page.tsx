export default function AccessDeniedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        fontFamily: "Inter, Segoe UI, sans-serif",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 28,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>Access Denied</h1>
        <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.5 }}>
          Your account does not have permission to view this area.
        </p>
      </section>
    </main>
  );
}
