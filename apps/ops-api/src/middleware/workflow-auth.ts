import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

const TOKEN_HEADER_PREFIX = "Bearer ";
const MIN_TOKEN_LENGTH = 32;

/**
 * Factory that returns an Express middleware enforcing a shared bearer token
 * on /workflow/* routes. Token compared in constant time (timingSafeEqual).
 *
 * Design:
 * - Fail-fast: throws at factory call time if WORKFLOW_API_TOKEN env var is
 *   missing or too short. Caught by startup env-validation in index.ts so the
 *   process never serves requests with a weak/missing secret.
 * - Never leaks token length, format, or other internals via 401 body.
 * - Logs every 401 with reason, IP, user-agent — but NO token material.
 *
 * Separate from the user JWT middleware (`auth.ts`) — this is a shared secret
 * between ops-api and the seo-health-v2 terminal workflow, not a per-user token.
 */
export function createWorkflowAuth() {
  const expected = process.env.WORKFLOW_API_TOKEN;
  if (!expected || expected.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `WORKFLOW_API_TOKEN env var must be set and at least ${MIN_TOKEN_LENGTH} chars. ` +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  const expectedBuf = Buffer.from(expected);

  return function workflowAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization ?? "";
    const ip = req.ip ?? "unknown";
    const ua = req.headers["user-agent"] ?? "unknown";

    const reject = (reason: string) => {
      console.warn(
        JSON.stringify({
          type: "workflow_auth_rejected",
          reason,
          ip,
          ua,
          timestamp: new Date().toISOString(),
        }),
      );
      return res.status(401).json({ error: "unauthorized" });
    };

    // Missing or non-Bearer header
    if (!authHeader.startsWith(TOKEN_HEADER_PREFIX)) {
      return reject("missing_or_non_bearer");
    }

    const token = authHeader.slice(TOKEN_HEADER_PREFIX.length);

    // Empty or whitespace-padded token
    if (token.length === 0) {
      return reject("empty_token");
    }
    if (token !== token.trim()) {
      return reject("whitespace_padded_token");
    }

    // Length mismatch — pre-check to avoid timingSafeEqual throwing on length mismatch
    const tokenBuf = Buffer.from(token);
    if (tokenBuf.length !== expectedBuf.length) {
      return reject("length_mismatch");
    }

    // Constant-time compare
    if (!crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      return reject("wrong_token");
    }

    return next();
  };
}
