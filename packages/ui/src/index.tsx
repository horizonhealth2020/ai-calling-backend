import React from "react";

export const PageShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <main style={{ fontFamily: "Inter, sans-serif", margin: "0 auto", maxWidth: 1200, padding: 24 }}>
    <h1>{title}</h1>
    {children}
  </main>
);
