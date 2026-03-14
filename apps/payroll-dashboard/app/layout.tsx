import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@ops/ui/src/theme.css";
import "@ops/ui/src/animations.css";
import "@ops/ui/src/responsive.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Payroll Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
