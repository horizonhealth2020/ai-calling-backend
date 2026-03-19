import type { AppRole } from "@ops/types";

/**
 * Decode JWT payload without a library (base64url decode).
 * Returns the roles array from the token payload.
 * This mirrors decodeTokenPayload in @ops/auth/client but returns roles.
 */
export function decodeRolesFromToken(token: string): AppRole[] {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return [];
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload));
    return decoded.roles ?? [];
  } catch {
    return [];
  }
}
