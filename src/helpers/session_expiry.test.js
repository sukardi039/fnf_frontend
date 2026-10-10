import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getAuthToken, request, setAuthHeader } from "./axios_helper";
import { expireSession, sessionLoginPath } from "./session_helper";

describe("unified interface session expiry", () => {
  it("requests a PDA challenge from the web simulator without borrowing a PDA bearer session", async () => {
    window.history.replaceState({}, "", "/home");
    api.defaults.adapter = vi.fn(async (config) => ({
      status: 201, headers: {}, data: { loginKey: "test-only" }, config,
    }));
    await request("POST", "/api/mobile-logins/request", { mobileNumber: "test-only" },
      { loginChallengeInterface: "PDA" });
    const config = api.defaults.adapter.mock.calls[0][0];
    expect(config.headers.get("X-Session-Interface")).toBe("PDA");
    expect(config.headers.get("Authorization")).toBe("Bearer web-token");
    expect(config.sessionInterface).toBe("WEB");
  });

  let adapter;
  const events = [];
  const onExpired = (event) => {
    events.push(event.detail);
    event.detail.handled = true;
  };
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    events.length = 0;
    adapter = api.defaults.adapter;
    window.addEventListener("auth:expired", onExpired);
    setAuthHeader("web-token", "WEB");
    setAuthHeader("pda-token", "PDA");
    sessionStorage.setItem("customer_auth_token", "mobile-token");
    localStorage.setItem("user_info", JSON.stringify({ id: "WEB" }));
    localStorage.setItem("pda_user_info", JSON.stringify({ staffId: "PDA" }));
    localStorage.setItem("customer_info", JSON.stringify({ customerId: "MOBILE" }));
  });
  afterEach(() => {
    api.defaults.adapter = adapter;
    window.removeEventListener("auth:expired", onExpired);
    delete window.showBackendError;
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it.each([
    ["WEB", "/home", "web-token", "/login"],
    ["PDA", "/pda/pickup", "pda-token", "/pda/login"],
    ["MOBILE", "/m/orders", "mobile-token", "/m/auth"],
  ])("%s attaches its session identity and closes immediately on protected 401 without refresh/dialog", async (surface, path, token, loginPath) => {
    window.history.replaceState({}, "", path);
    window.showBackendError = vi.fn(() => new Promise(() => {}));
    api.defaults.adapter = vi.fn(async (config) => {
      expect(config.headers.get("X-Session-Interface")).toBe(surface);
      expect(config.headers.get("Authorization")).toBe(`Bearer ${token}`);
      throw Object.assign(new Error("Expired"), { config, response: { status: 401, data: {} } });
    });
    await expect(request("GET", "/api/orders", null, { skipAuthRedirect: true })).rejects.toThrow("Expired");
    expect(api.defaults.adapter).toHaveBeenCalledOnce();
    expect(window.showBackendError).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ interface: surface, loginPath });
    expect(sessionLoginPath(surface)).toBe(loginPath);
    if (surface === "WEB") {
      expect(getAuthToken("WEB")).toBeNull();
      expect(localStorage.getItem("user_info")).toBeNull();
      expect(getAuthToken("PDA")).toBe("pda-token");
    } else if (surface === "PDA") {
      expect(getAuthToken("PDA")).toBeNull();
      expect(localStorage.getItem("pda_user_info")).toBeNull();
      expect(getAuthToken("WEB")).toBe("web-token");
    } else {
      expect(sessionStorage.getItem("customer_auth_token")).toBeNull();
      expect(localStorage.getItem("customer_info")).toBeNull();
      expect(getAuthToken("WEB")).toBe("web-token");
    }
  });

  it.each(["SESSION_EXPIRED", "SESSION_REVOKED", "INVALID_SESSION"])("explicit %s overrides redirect opt-out even on authentication endpoints", async (code) => {
    api.defaults.adapter = vi.fn(async (config) => {
      throw Object.assign(new Error(code), { config, response: { status: 403, data: { code } } });
    });
    await expect(request("POST", "/login", {}, { skipAuthRedirect: true })).rejects.toThrow(code);
    expect(events).toHaveLength(1);
    expect(getAuthToken("WEB")).toBeNull();
  });

  it("recognizes the backend errorCode expiry field", async () => {
    api.defaults.adapter = vi.fn(async (config) => {
      throw Object.assign(new Error("Expired"), {
        config, response: { status: 403, data: { errorCode: "SESSION_EXPIRED" } },
      });
    });
    await expect(request("GET", "/api/orders", null, { skipAuthRedirect: true })).rejects.toThrow();
    expect(events).toHaveLength(1);
  });

  it.each(["/login", "/register", "/api/mobile-logins/login", "/api/mobile-logins/verify",
    "/api/auth/customers/login", "/api/auth/customers/register"])("invalid login at %s stays a local form error", async (url) => {
    api.defaults.adapter = vi.fn(async (config) => {
      throw Object.assign(new Error("Invalid credentials"), { config, response: { status: 401, data: {} } });
    });
    await expect(request("POST", url, {}, { skipBackendErrorDialog: true })).rejects.toThrow("Invalid credentials");
    expect(events).toHaveLength(0);
    expect(getAuthToken("WEB")).toBe("web-token");
  });

  it.each([403, 410, 500])("business error %s without expiry code does not terminate session", async (status) => {
    api.defaults.adapter = vi.fn(async (config) => {
      throw Object.assign(new Error("Business error"), { config, response: { status, data: { code: "ORDER_EXPIRED" } } });
    });

    await expect(request("POST", "/api/orders/verify", {}, { skipBackendErrorDialog: true })).rejects.toThrow();
    expect(events).toHaveLength(0);
  });

  it("network errors do not close a valid session", async () => {
    api.defaults.adapter = vi.fn(async (config) => {
      throw Object.assign(new Error("Network unavailable"), { config });
    });
    await expect(request("GET", "/api/orders", null, { skipBackendErrorDialog: true }))
      .rejects.toThrow("Network unavailable");
    expect(events).toHaveLength(0);
    expect(getAuthToken("WEB")).toBe("web-token");
  });

  it("routes an explicitly customer-scoped request separately even from the web page", async () => {
    window.history.replaceState({}, "", "/home");
    api.defaults.adapter = vi.fn(async (config) => {
      expect(config.headers.get("X-Session-Interface")).toBe("MOBILE");
      expect(config.headers.get("Authorization")).toBe("Bearer mobile-token");
      throw Object.assign(new Error("Expired"), { config, response: { status: 401, data: {} } });
    });
    await expect(request("GET", "/api/transactions", null, { authScope: "customer" })).rejects.toThrow();
    expect(events[0].interface).toBe("MOBILE");
    expect(getAuthToken("WEB")).toBe("web-token");
  });

  it("cannot restore a closed session from a late successful response", async () => {
    let finish;
    api.defaults.adapter = vi.fn((config) => new Promise((resolve) => {
      finish = () => resolve({ status: 200, data: { token: "late-token" }, headers: {}, config });
    }));
    const pending = request("GET", "/api/params");
    await vi.waitFor(() => expect(finish).toBeDefined());
    expireSession("WEB");
    finish();
    await expect(pending).rejects.toThrow("Session ended");
    expect(getAuthToken("WEB")).toBeNull();
  });

  it("deduplicates concurrent expiry signals from requests issued under the old session", async () => {
    const fail = [];
    api.defaults.adapter = vi.fn((config) => new Promise((_, reject) => {
      fail.push(() => reject(Object.assign(new Error("Expired"), { config, response: { status: 401, data: {} } })));
    }));
    const requests = Promise.allSettled([request("GET", "/api/a"), request("GET", "/api/b")]);
    await vi.waitFor(() => expect(fail).toHaveLength(2));
    fail.forEach((reject) => reject());
    await requests;
    expect(events).toHaveLength(1);
  });
});
