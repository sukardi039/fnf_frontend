import axios from "axios";
import {
  currentSessionInterface, expireSession, isBackendSessionExpiry,
  sessionGeneration, sessionInterfaceFor,
} from "./session_helper";

// Simple token storage helpers (persisted in localStorage)
export const getAuthToken = (surface = currentSessionInterface()) => {
  if (surface === "PDA") {
    return window.sessionStorage.getItem("pda_auth_token") ||
      window.localStorage.getItem("pda_auth_token") || null;
  }
  // Prefer sessionStorage over localStorage for access tokens as we migrate
  // toward secure HttpOnly cookies. sessionStorage is cleared when the tab closes.
  try {
    const sessionToken = window.sessionStorage.getItem("auth_token");
    if (sessionToken && sessionToken !== "null") return sessionToken;
  } catch {
    // ignore
  }

  const token = window.localStorage.getItem("auth_token");
  if (token && token !== "null") return token;

  try {
    const userInfo = window.localStorage.getItem("user_info");
    if (userInfo) {
      const userObj = JSON.parse(userInfo);
      return userObj?.token || null;
    }
  } catch {
    // ignore
  }

  return null;
};

const isPdaPath = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/pda/");

const isTvPath = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/tv");

const isCustomerRequest = (config) =>
  config.authScope === "customer" ||
  (config.authScope !== "system" && typeof window !== "undefined" &&
    window.location.pathname.startsWith("/m/"));

export const setCustomerAuthToken = (token) => {
  if (token) {
    window.sessionStorage.setItem("customer_auth_token", normalizeBearerToken(token));
  } else {
    window.sessionStorage.removeItem("customer_auth_token");
  }
};

export const setAuthHeader = (token, surface = currentSessionInterface()) => {
  const storageKey = surface === "PDA" ? "pda_auth_token" : "auth_token";
  if (token !== null && token !== undefined) {
    try {
      window.sessionStorage.setItem(storageKey, token);
    } catch {
      // ignore
    }
    window.localStorage.setItem(storageKey, token);
  } else {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    window.localStorage.removeItem(storageKey);
  }
};

const normalizeBearerToken = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^Bearer\s+/i.test(raw)) return raw.replace(/^Bearer\s+/i, "").trim();
  return raw;
};

const extractTokenFromPayload = (payload) => {
  if (!payload || typeof payload !== "object") return "";

  const directKeys = ["accessToken", "token", "jwt", "idToken"];
  for (const key of directKeys) {
    const normalized = normalizeBearerToken(payload?.[key]);
    if (normalized) return normalized;
  }

  if (payload?.data && typeof payload.data === "object") {
    for (const key of directKeys) {
      const normalized = normalizeBearerToken(payload.data?.[key]);
      if (normalized) return normalized;
    }
  }

  return "";
};

const extractTokenFromResponse = (response) => {
  const headerToken =
    normalizeBearerToken(response?.headers?.authorization) ||
    normalizeBearerToken(response?.headers?.Authorization) ||
    normalizeBearerToken(response?.headers?.["x-access-token"]);
  if (headerToken) return headerToken;

  return extractTokenFromPayload(response?.data);
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true;
  }
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const MESSAGE_KEYS = [
  "cause",
  "error",
  "errors",
  "detail",
  "details",
  "exception",
  "response",
  "data",
  "message",
  "msg",
  "reason",
];

const extractDeepestMessage = (value, visited = new Set()) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value.trim();

  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i -= 1) {
      const nested = extractDeepestMessage(value[i], visited);
      if (nested) return nested;
    }
    return "";
  }

  if (typeof value !== "object") return "";
  if (visited.has(value)) return "";
  visited.add(value);

  for (const key of MESSAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const nested = extractDeepestMessage(value[key], visited);
    if (nested) return nested;
  }

  for (const nestedValue of Object.values(value)) {
    const nested = extractDeepestMessage(nestedValue, visited);
    if (nested) return nested;
  }

  return "";
};

const normalizeAxiosErrorMessage = (error) => {
  const fromPayload = extractDeepestMessage(error?.response?.data);
  const fromStatusText = extractDeepestMessage(error?.response?.statusText);
  const fromMessage = extractDeepestMessage(error?.message);
  const message =
    fromPayload || fromStatusText || fromMessage || "Server error";

  if (error && typeof error === "object") {
    error.userMessage = message;

    if (error.response?.data && typeof error.response.data === "object") {
      error.response.data.message = message;
    }
  }

  return message;
};

// Create an axios instance we control
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // allow sending cookies for refresh token flows
});

// Request interceptor: attach access token if present
api.interceptors.request.use(
  (config) => {
    config.authScope = isCustomerRequest(config) ? "customer" : "system";
    config.sessionInterface = sessionInterfaceFor(config);
    config.sessionGeneration = sessionGeneration(config.sessionInterface);
    config.headers["X-Session-Interface"] = config.url === "/api/mobile-logins/request"
      ? config.loginChallengeInterface || config.sessionInterface
      : config.sessionInterface;
    const token = config.authScope === "customer"
      ? window.sessionStorage.getItem("customer_auth_token")
      : getAuthToken(config.sessionInterface);
    delete config.headers.Authorization;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// Session expiry is terminal; never refresh or replay the rejected request.
api.interceptors.response.use(
  (response) => {
    if (response.config.sessionGeneration !== sessionGeneration(response.config.sessionInterface)) {
      return Promise.reject(Object.assign(new Error("Session ended before response arrived"), {
        config: response.config, sessionEnded: true,
      }));
    }
    const responseToken = extractTokenFromResponse(response);
    // Prefer cookies; only use body tokens as a transitional fallback.
    if (responseToken) {
      if (isCustomerRequest(response.config)) setCustomerAuthToken(responseToken);
      else setAuthHeader(responseToken, response.config.sessionInterface);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);
    if (originalRequest.sessionGeneration !== sessionGeneration(originalRequest.sessionInterface)) {
      return Promise.reject(error);
    }
    if (isBackendSessionExpiry(error)) {
      expireSession(originalRequest.sessionInterface);
      return Promise.reject(error);
    }

    // Show blocking error prompt (if available in the app) and wait.
    // Skipped for PDA and TV paths — those surfaces handle backend failures locally.
    const tryShowBlockingError = async (msg) => {
      if (isPdaPath() || isTvPath() || originalRequest.skipBackendErrorDialog) {
        return;
      }
      try {
        const timeoutMs = parseInt(
          import.meta.env.VITE_ERROR_ACK_TIMEOUT_MS || "0",
          10,
        );
        if (typeof window !== "undefined" && window.showBackendError) {
          // window.showBackendError resolves when user acknowledges or timeout
          await window.showBackendError(msg, timeoutMs);
        } else if (timeoutMs > 0) {
          // Fallback: wait for the timeout
          await new Promise((res) => setTimeout(res, timeoutMs));
        }
      } catch {
        // ignore any errors from the UI handshake
      }
    };

    // Use the deepest backend message so users see the actual root cause.
    const backendMessage = normalizeAxiosErrorMessage(error);
    // Fire and wait for UI acknowledgement before proceeding with recovery
    await tryShowBlockingError(backendMessage);

    return Promise.reject(error);
  },
);

// Backwards-compatible request helper used across the app
export const request = (method, url, data, config = {}) =>
  api({ method, url, data, ...config });
