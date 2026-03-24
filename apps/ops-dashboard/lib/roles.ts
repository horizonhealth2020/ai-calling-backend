import type { AppRole } from "@ops/types";

export interface TabConfig {
  path: string;
  label: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { path: "/manager", label: "Manager" },
  { path: "/payroll", label: "Payroll" },
  { path: "/owner", label: "Owner" },
  { path: "/cs", label: "Customer Service" },
];

export const TAB_ROLES: Record<string, AppRole[]> = {
  "/manager": ["MANAGER", "SUPER_ADMIN"],
  "/payroll": ["PAYROLL", "SUPER_ADMIN"],
  "/owner": ["OWNER_VIEW", "SUPER_ADMIN"],
  "/cs": ["CUSTOMER_SERVICE", "OWNER_VIEW", "SUPER_ADMIN"],
};

export function getTabsForRoles(roles: AppRole[]): TabConfig[] {
  return TAB_CONFIG.filter(tab =>
    TAB_ROLES[tab.path]?.some(r => roles.includes(r))
  );
}

export function getDefaultTab(roles: AppRole[]): string {
  if (roles.includes("SUPER_ADMIN") || roles.includes("OWNER_VIEW")) return "/owner";
  if (roles.includes("MANAGER")) return "/manager";
  if (roles.includes("PAYROLL")) return "/payroll";
  if (roles.includes("CUSTOMER_SERVICE")) return "/cs";
  return "/owner";
}
