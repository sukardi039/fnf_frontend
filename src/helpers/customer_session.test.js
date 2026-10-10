import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, request } from "./axios_helper";
import { clearCustomerSession, storeCustomerSession } from "./customer_helper";
import { listCustomerTransactions } from "./customer_cart_helper";

describe("customer and system session isolation", () => {
  let adapter;
  const onExpired = (event) => { event.detail.handled = true; };
  beforeEach(() => {
    window.addEventListener("auth:expired", onExpired);
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("auth_token", "system-session");
    sessionStorage.setItem("auth_token", "system-session");
    adapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn(async (config) => ({
      data: { items: [], total: 0 }, status: 200, statusText: "OK", headers: {}, config,
    }));
  });
  afterEach(() => {
    window.removeEventListener("auth:expired", onExpired);
    api.defaults.adapter = adapter;
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("uses the customer cookie without attaching the saved system bearer", async () => {
    window.history.replaceState({}, "", "/m/orders");
    storeCustomerSession({ data: { principalType: "CUSTOMER", customerId: "CUSTOMER-1" } });
    await listCustomerTransactions({ customerId: "STALE-PROFILE", page: 0, size: 20 });
    const config = api.defaults.adapter.mock.calls[0][0];
    expect(config.url).toBe("/api/transactions?customerId=STALE-PROFILE&page=0&size=20");
    expect(config.headers.get("Authorization")).toBeUndefined();
    expect(config.withCredentials).toBe(true);
    expect(localStorage.getItem("auth_token")).toBe("system-session");
  });

  it("keeps transitional customer tokens separate and preserves system login on customer logout", async () => {
    storeCustomerSession({ data: {
      principalType: "CUSTOMER", customerId: "CUSTOMER-1", accessToken: "customer-session",
    } });
    await listCustomerTransactions();
    expect(api.defaults.adapter.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer customer-session");
    await request("GET", "/api/params", null, { authScope: "system" });
    expect(api.defaults.adapter.mock.calls[1][0].headers.get("Authorization")).toBe("Bearer system-session");
    clearCustomerSession();
    expect(sessionStorage.getItem("customer_auth_token")).toBeNull();
    expect(sessionStorage.getItem("auth_token")).toBe("system-session");
    expect(localStorage.getItem("auth_token")).toBe("system-session");
  });

  it("scopes catalog/store requests on mobile to the customer session too", async () => {
    window.history.replaceState({}, "", "/m/browse");
    await request("GET", "/api/stores");
    expect(api.defaults.adapter.mock.calls[0][0].headers.get("Authorization")).toBeUndefined();
  });

  it("does not let a customer response overwrite system credentials", async () => {
    api.defaults.adapter.mockImplementation(async (config) => ({
      data: { accessToken: "new-customer-session" }, status: 200, statusText: "OK", headers: {}, config,
    }));
    await request("POST", "/api/auth/customers/login", {}, { authScope: "customer" });
    expect(sessionStorage.getItem("customer_auth_token")).toBe("new-customer-session");
    expect(sessionStorage.getItem("auth_token")).toBe("system-session");
  });

  it("does not refresh a rejected customer request into a system session", async () => {
    storeCustomerSession({ data: { customerId: "CUSTOMER-1", token: "expired-customer" } });
    api.defaults.adapter.mockImplementation(async (config) => {
      throw Object.assign(new Error("Customer session expired"), {
        config, response: { status: 401, data: { message: "Customer session expired" } },
      });
    });
    await expect(listCustomerTransactions()).rejects.toThrow("Customer session expired");
    expect(api.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("customer_auth_token")).toBeNull();
    expect(localStorage.getItem("customer_info")).toBeNull();
    expect(sessionStorage.getItem("auth_token")).toBe("system-session");
  });
});
