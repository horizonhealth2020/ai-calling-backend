export type AppRole = "SUPER_ADMIN" | "OWNER_VIEW" | "MANAGER" | "PAYROLL" | "SERVICE" | "ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
};
