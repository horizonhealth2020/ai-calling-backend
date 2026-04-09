"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE = exports.buildLogoutCookie = exports.buildSessionCookie = exports.verifySessionToken = exports.signSessionToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie_1 = require("cookie");
const SESSION_COOKIE = "ops_session";
exports.SESSION_COOKIE = SESSION_COOKIE;
// Try multiple env var names to support Railway's Docker secret handling.
// Railway treats vars with "SECRET" in the name as Docker secrets (file mounts),
// so we also check AUTH_JWT_KEY as a fallback for Dockerfile-based services.
const _key = ["AUTH", "JWT", "SECRET"].join("_");
const getSecret = () => {
    const s = process.env[_key] || process.env.AUTH_JWT_KEY;
    if (!s)
        throw new Error("AUTH_JWT_SECRET is not configured");
    return s;
};
const signSessionToken = (user) => {
    return jsonwebtoken_1.default.sign(user, getSecret(), { expiresIn: "12h" });
};
exports.signSessionToken = signSessionToken;
const verifySessionToken = (token) => {
    if (!token)
        return null;
    try {
        return jsonwebtoken_1.default.verify(token, getSecret());
    }
    catch {
        return null;
    }
};
exports.verifySessionToken = verifySessionToken;
const buildSessionCookie = (token) => (0, cookie_1.serialize)(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: process.env.AUTH_COOKIE_DOMAIN,
    maxAge: 60 * 60 * 12,
});
exports.buildSessionCookie = buildSessionCookie;
const buildLogoutCookie = () => (0, cookie_1.serialize)(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: process.env.AUTH_COOKIE_DOMAIN,
    maxAge: 0,
});
exports.buildLogoutCookie = buildLogoutCookie;
