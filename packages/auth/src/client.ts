/**
 * Client-side auth utilities for browser environments.
 * Manages JWT token via localStorage + URL query param capture.
 */

const TOKEN_KEY = "ops_session_token";
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes before expiry
const REQUEST_TIMEOUT_MS = 30_000; // 30 second timeout

/** Read session_token from URL, store in localStorage, clean the URL. */
export function captureTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("session_token");
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    // Remove token from URL without reload
    params.delete("session_token");
    const clean = params.toString();
    const newUrl = window.location.pathname + (clean ? `?${clean}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }
  return token ?? localStorage.getItem(TOKEN_KEY);
}

/** Get the stored token (does NOT check URL — call captureTokenFromUrl first). */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Clear token (logout). */
export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

/** Decode JWT payload without a library (base64url decode). */
function decodeTokenPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** Check if token expires within the threshold and refresh if needed. */
let refreshing: Promise<void> | null = null;
async function ensureTokenFresh(): Promise<void> {
  const token = getToken();
  if (!token) return;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return;

  const expiresAt = payload.exp * 1000;
  const now = Date.now();

  // Token already expired — clear and bail
  if (now >= expiresAt) {
    clearToken();
    return;
  }

  // Token still valid but not near expiry
  if (expiresAt - now > REFRESH_THRESHOLD_MS) return;

  // Deduplicate concurrent refresh calls
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const apiUrl = (typeof window !== "undefined" && (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_OPS_API_URL)
        || process.env.NEXT_PUBLIC_OPS_API_URL || "";
      const res = await fetch(`${apiUrl}/api/auth/refresh`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      } else {
        // Refresh failed — token may be revoked
        clearToken();
      }
    } catch {
      // Network error during refresh — don't clear token, let the original request try
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Wrapper around fetch that injects the Bearer token header with timeout and auto-refresh. */
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  // Try to refresh token if near expiry
  await ensureTokenFresh();

  const token = getToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...opts, headers, signal: opts.signal ?? controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 30 seconds");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
