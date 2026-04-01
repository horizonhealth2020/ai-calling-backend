export type AppRole = "SUPER_ADMIN" | "OWNER_VIEW" | "MANAGER" | "PAYROLL" | "SERVICE" | "ADMIN" | "CUSTOMER_SERVICE";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: AppRole[];
};

export { US_STATES, type StateCode } from "./us-states";
