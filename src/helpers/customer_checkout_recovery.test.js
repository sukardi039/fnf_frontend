import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt } from "./customer_checkout_recovery";

const snapshot = () => ({
  storeId: "STORE-1", paymentMode: "PAY_AT_COUNTER",
  items: [{ skuId: "APPLE", productName: "Apple", uom: "EA", quantity: 2 }],
  createKey: crypto.randomUUID(), checkoutKey: crypto.randomUUID(),
  itemKeys: [crypto.randomUUID()], cartId: null, added: 0, quoteId: null,
  pickupSlot: {
    pickupSlotStart: "2026-10-09T08:30:00Z", pickupSlotEnd: "2026-10-09T09:00:00Z",
    pickupExpiresAt: "2026-10-09T09:30:00Z", pickupTimezone: "Asia/Singapore",
  },
});

describe("customer checkout recovery", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

  it("restores original snapshots and keys only for the matching customer", () => {
    const attempt = snapshot();
    saveCheckoutAttempt("CUSTOMER-1", attempt);
    expect(readCheckoutAttempt("CUSTOMER-1")).toEqual(attempt);
    expect(readCheckoutAttempt("CUSTOMER-2")).toBeNull();
    clearCheckoutAttempt("CUSTOMER-2");
    expect(readCheckoutAttempt("CUSTOMER-1")).toEqual(attempt);
    clearCheckoutAttempt("CUSTOMER-1");
    expect(readCheckoutAttempt("CUSTOMER-1")).toBeNull();
  });

  it("restores an acknowledged cart/item stage without regenerating keys", () => {
    const attempt = { ...snapshot(), cartId: "CART-1", quoteId: "QUOTE-1", added: 1 };
    saveCheckoutAttempt("CUSTOMER-1", attempt);
    expect(readCheckoutAttempt("CUSTOMER-1")).toEqual(attempt);
  });

  it.each([
    { storeId: " " }, { added: 1 }, { quoteId: "QUOTE-1" }, { cartId: "" },
    { itemKeys: ["invalid-key"] }, { items: [null] }, { added: 2 },
    { items: [{ skuId: "APPLE", quantity: true }] },
    { pickupSlot: { pickupTimezone: "invalid" } },
  ])("rejects malformed recovery stages: %j", (invalid) => {
    saveCheckoutAttempt("CUSTOMER-1", { ...snapshot(), ...invalid });
    expect(() => readCheckoutAttempt("CUSTOMER-1")).toThrow("customer.cart.recoveryInvalid");
  });

  it("rejects altered pickup durations", () => {
    const attempt = snapshot();
    attempt.pickupSlot.pickupExpiresAt = attempt.pickupSlot.pickupSlotEnd;
    saveCheckoutAttempt("CUSTOMER-1", attempt);
    expect(() => readCheckoutAttempt("CUSTOMER-1")).toThrow("customer.cart.recoveryInvalid");
  });

  it("fails explicitly for missing identity, corrupt JSON and inaccessible storage", () => {
    expect(() => readCheckoutAttempt(" ")).toThrow("customer.cart.recoveryIdentityMissing");
    sessionStorage.setItem("customer-checkout:CUSTOMER-1", "{invalid");
    expect(() => readCheckoutAttempt("CUSTOMER-1")).toThrow();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    expect(() => saveCheckoutAttempt("CUSTOMER-1", snapshot())).toThrow("Storage denied");
  });
});
