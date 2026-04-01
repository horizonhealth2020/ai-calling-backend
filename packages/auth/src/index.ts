import jwt from "jsonwebtoken";
import { serialize } from "cookie";
import type { SessionUser } from "@ops/types";

const SESSION_COOKIE = "ops_session";

// Try multiple env var names to support Railway's Docker secret handling.
// Railway treats vars with "SECRET" in the name as Docker secrets (file mounts),
// so we also check AUTH_JWT_KEY as a fallback for Dockerfile-based services.
const _key = ["AUTH", "JWT", "SECRET"].join("_");
const getSecret = () => {
  const s = process.env[_key] || process.env.AUTH_JWT_KEY;
  if (!s) throw new Error("AUTH_JWT_SECRET is not configured");
  return s;
};

export const signSessionToken = (user: SessionUser): string => {
  return jwt.sign(user, getSecret(), { expiresIn: "12h" });
};

export const verifySessionToken = (token?: string): SessionUser | null => {
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret()) as SessionUser;
  } catch {
    return null;
  }
};

export const buildSessionCookie = (token: string): string =>
  serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: process.env.AUTH_COOKIE_DOMAIN,
    maxAge: 60 * 60 * 12,
  });

export const buildLogoutCookie = (): string =>
  serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: process.env.AUTH_COOKIE_DOMAIN,
    maxAge: 0,
  });

export { SESSION_COOKIE };
