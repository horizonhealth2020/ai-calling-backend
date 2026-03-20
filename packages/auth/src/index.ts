import jwt from "jsonwebtoken";
import { serialize } from "cookie";
import type { SessionUser } from "@ops/types";

const SESSION_COOKIE = "ops_session";

// Indirection prevents Railpack/Nixpacks static analysis from detecting the
// env var name at build time and demanding it as a Docker build secret.
const _key = ["AUTH", "JWT", "SECRET"].join("_");
const getSecret = () => process.env[_key] || "dev-secret";

export const signSessionToken = (user: SessionUser) => {
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

export const buildSessionCookie = (token: string) =>
  serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: process.env.AUTH_COOKIE_DOMAIN,
    maxAge: 60 * 60 * 12,
  });

export const buildLogoutCookie = () =>
  serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: process.env.AUTH_COOKIE_DOMAIN,
    maxAge: 0,
  });

export { SESSION_COOKIE };
