import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pickupCommandKey } from "./pickup_command_helper";

describe("persistent pickup command keys", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem("auth_token", "STAFF-SESSION");
  });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });
  it("reuses the command key across remounts without storing QR or receipt content", async () => {
    const key = await pickupCommandKey("STORE-1", "TX-1", "arrival", "PRIVATE-QR");
    expect(await pickupCommandKey("STORE-1", "TX-1", "arrival", "PRIVATE-QR")).toBe(key);
    expect(JSON.stringify(sessionStorage)).not.toContain("PRIVATE-QR");
    expect(await pickupCommandKey("STORE-1", "TX-1", "cash", "Receipt note")).not.toBe(key);
  });
  it("separates payload, order, store and authenticated session", async () => {
    const key = await pickupCommandKey("STORE-1", "TX-1", "prepare", "READY");
    expect(await pickupCommandKey("STORE-1", "TX-1", "prepare", "PREPARING")).not.toBe(key);
    expect(await pickupCommandKey("STORE-2", "TX-1", "prepare", "READY")).not.toBe(key);
    expect(await pickupCommandKey("STORE-1", "TX-2", "prepare", "READY")).not.toBe(key);
    sessionStorage.setItem("auth_token", "OTHER-SESSION");
    expect(await pickupCommandKey("STORE-1", "TX-1", "prepare", "READY")).not.toBe(key);
  });
});
