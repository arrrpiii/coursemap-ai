// Lightweight fetch wrapper used by all API modules.

// API call sites pass paths like "/auth/login" — never with the /api prefix.
// In dev, Vite proxies `/api/*` to http://localhost:8000 (see vite.config.js).
// In production, set VITE_API_URL to the deployed backend ORIGIN (no /api
// suffix), e.g. VITE_API_URL=https://coursemap-ai-backend.onrender.com — the
// /api prefix is appended here automatically.
const BASE = (import.meta.env.VITE_API_URL || "") + "/api";
const TOKEN_KEY = "coursemap_token";

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new Error(networkErr.message || "Network error");
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        message =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch (_) {
      // ignore parse errors
    }

    // Auto-logout on 401 so the app redirects to /login on next render.
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // Soft-redirect without a hard reload
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body || {}) });
}

export function apiPatch(path, body) {
  return request(path, { method: "PATCH", body: JSON.stringify(body || {}) });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}