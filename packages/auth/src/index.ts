import jwt from "jsonwebtoken";
import { serialize } from "cookie";
import type { SessionUser } from "@ops/types";

const SESSION_COOKIE = "ops_session";

export const signSessionToken = (user: SessionUser) => {
  const secret = process.env.AUTH_JWT_SECRET || "dev-secret";
  return jwt.sign(user, secret, { expiresIn: "12h" });
};

export const verifySessionToken = (token?: string): SessionUser | null => {
  if (!token) return null;
  try {
    const secret = process.env.AUTH_JWT_SECRET || "dev-secret";
    return jwt.verify(token, secret) as SessionUser;
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
