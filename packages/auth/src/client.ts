/**
 * Client-side auth utilities for browser environments.
 * Manages JWT token via localStorage + URL query param capture.
 */

const TOKEN_KEY = "ops_session_token";

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

/** Wrapper around fetch that injects the Bearer token header. */
export function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...opts, headers });
}
