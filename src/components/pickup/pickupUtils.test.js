import { describe, expect, it } from "vitest";
import { buildPickupAllocations, matchesPickupQueueView, validatePickupOrder } from "./pickupUtils";
import { pickupOrder } from "./pickupTestData";

describe("pickup order validation", () => {
  it("routes wholly unscheduled online orders to reconciliation regardless of age", () => {
    const unscheduled = { ...pickupOrder, state: "PAYMENT_PENDING", paymentStatus: "PENDING",
      pickupSlotStart: null, pickupSlotEnd: null, pickupExpiresAt: null,
      actions: Object.fromEntries(Object.keys(pickupOrder.actions).map((key) => [key, false])) };
    expect(matchesPickupQueueView(unscheduled, "ACTIVE")).toBe(false);
    expect(matchesPickupQueueView(unscheduled, "RECONCILIATION")).toBe(true);
    expect(validatePickupOrder(unscheduled, "STORE-1", "TX-1")).toBe(unscheduled);
    expect(() => validatePickupOrder({ ...unscheduled,
      actions: { ...unscheduled.actions, canStartPreparation: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
  });
  it.each(["HANDED_OVER", "CANCELLED", "REFUNDED"])("keeps %s out of both operational views", (state) => {
    const order = { ...pickupOrder, state, paymentMode: "CASH" };
    expect(matchesPickupQueueView(order, "ACTIVE")).toBe(false);
    expect(matchesPickupQueueView(order, "RECONCILIATION")).toBe(false);
  });
  it("separates reconciliation from active orders without excluding paid overdue or held orders", () => {
    for (const order of [
      pickupOrder, { ...pickupOrder, pickupTimingStatus: "OVERDUE" },
      { ...pickupOrder, fulfilmentHoldReason: "LATE_PAYMENT" },
      { ...pickupOrder, paymentResolutionStatus: "CHECKING" },
    ]) {
      expect(matchesPickupQueueView(order, "ACTIVE")).toBe(true);
      expect(matchesPickupQueueView(order, "RECONCILIATION")).toBe(false);
    }
    for (const order of [
      { ...pickupOrder, paymentMode: "CASH" },
      { ...pickupOrder, state: "EXPIRED", paymentStatus: "SUCCESS" },
    ]) {
      expect(matchesPickupQueueView(order, "ACTIVE")).toBe(false);
      expect(matchesPickupQueueView(order, "RECONCILIATION")).toBe(true);
    }
    const expired = { ...pickupOrder, state: "EXPIRED", paymentStatus: "PENDING" };
    expect(matchesPickupQueueView(expired, "ACTIVE")).toBe(false);
    expect(matchesPickupQueueView(expired, "RECONCILIATION")).toBe(false);
  });
  it.each(["LATE_PAYMENT", "QUALITY_REVIEW"])("accepts %s holds only with all actions disabled", (reason) => {
    const held = { ...pickupOrder, fulfilmentHoldReason: reason,
      actions: Object.fromEntries(Object.keys(pickupOrder.actions).map((key) => [key, false])) };
    expect(validatePickupOrder(held, "STORE-1", "TX-1")).toBe(held);
    expect(() => validatePickupOrder({ ...held,
      actions: { ...held.actions, canStartPreparation: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
  });
  it("keeps overdue paid preparation eligible", () => {
    const overdue = { ...pickupOrder, pickupTimingStatus: "OVERDUE" };
    expect(validatePickupOrder(overdue, "STORE-1", "TX-1")).toBe(overdue);
  });
  it("accepts expired arrival policy only for read-only terminal details", () => {
    const expired = { ...pickupOrder, paymentMode: "PAY_AT_COUNTER",
      preparationPolicy: "ON_ARRIVAL", arrivalStatus: "EXPIRED", state: "EXPIRED",
      actions: {
        canRecordArrival: false, canConfirmCash: false, canAllocateLots: false,
        canStartPreparation: false, canMarkReady: false, canHandover: false,
      },
    };
    expect(validatePickupOrder(expired, "STORE-1", "TX-1")).toBe(expired);
    expect(() => validatePickupOrder({ ...expired,
      actions: { ...expired.actions, canHandover: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
  });
  it.each(["CASH", "PAY_AT_COUNTER"])("accepts legacy %s detail only when every action is disabled", (paymentMode) => {
    const legacy = { ...pickupOrder, paymentMode, preparationPolicy: null, arrivalStatus: null,
      state: "CASH_PENDING_CONFIRMATION", paymentStatus: "PENDING",
      actions: {
        canRecordArrival: false, canConfirmCash: false, canAllocateLots: false,
        canStartPreparation: false, canMarkReady: false, canHandover: false,
      },
    };
    expect(validatePickupOrder(legacy, "STORE-1", "TX-1")).toBe(legacy);
    expect(() => validatePickupOrder({ ...legacy,
      actions: { ...legacy.actions, canConfirmCash: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
  });

  it("accepts scoped mobile order details and rejects mismatched store, transaction and channel", () => {
    expect(validatePickupOrder(pickupOrder, "STORE-1", "TX-1")).toBe(pickupOrder);
    expect(() => validatePickupOrder(pickupOrder, "STORE-2", "TX-1")).toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder(pickupOrder, "STORE-1", "TX-2")).toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder({ ...pickupOrder, channel: "STAFF_ASSISTED" }, "STORE-1", "TX-1"))
      .toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder({ ...pickupOrder, actions: {} }, "STORE-1", "TX-1"))
      .toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder({
      ...pickupOrder, actions: { ...pickupOrder.actions, canHandover: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder({
      ...pickupOrder, paymentStatus: "PENDING",
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
  });

  it("builds split-lot allocations against original sale lines", () => {
    expect(buildPickupAllocations(pickupOrder.items, {
      "LINE-1": [{ lotId: "LOT-1", quantity: "2" }, { lotId: "LOT-2", quantity: "1" }],
    })).toEqual([
      { saleLineId: "LINE-1", lotId: "LOT-1", quantity: 2, uom: "EA" },
      { saleLineId: "LINE-1", lotId: "LOT-2", quantity: 1, uom: "EA" },
    ]);
  });

  it.each([
    [[], "pickup.allocationRequired"],
    [[{ lotId: "LOT-1", quantity: "0" }], "pickup.invalidAllocation"],
    [[{ lotId: "UNKNOWN", quantity: "3" }], "pickup.invalidAllocation"],
    [[{ lotId: "LOT-1", quantity: "3" }], "pickup.insufficientLot"],
    [[{ lotId: "LOT-2", quantity: "2" }], "pickup.quantityMismatch"],
    [[{ lotId: "LOT-2", quantity: "1" }, { lotId: "LOT-2", quantity: "2" }], "pickup.invalidAllocation"],
  ])("rejects invalid allocation %j", (rows, message) => {
    expect(() => buildPickupAllocations(pickupOrder.items, { "LINE-1": rows })).toThrow(message);
  });

  it("checks a lot's aggregate availability across sale lines", () => {
    const line = { ...pickupOrder.items[0], quantity: 2 };
    expect(() => buildPickupAllocations([line, { ...line, saleLineId: "LINE-2" }], {
      "LINE-1": [{ lotId: "LOT-1", quantity: 2 }],
      "LINE-2": [{ lotId: "LOT-1", quantity: 2 }],
    })).toThrow("pickup.insufficientLot");
  });

  it("accepts arrival/cash actions but rejects preparation before arrival or payment", () => {
    const unpaid = {
      ...pickupOrder, paymentMode: "PAY_AT_COUNTER", preparationPolicy: "ON_ARRIVAL",
      arrivalStatus: "EXPECTED", paymentStatus: "PENDING", state: "CASH_PENDING_CONFIRMATION",
      actions: {
        canRecordArrival: true, canConfirmCash: false,
        canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: false,
      },
    };
    expect(validatePickupOrder(unpaid, "STORE-1", "TX-1")).toBe(unpaid);
    expect(() => validatePickupOrder({
      ...unpaid, actions: { ...unpaid.actions, canStartPreparation: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder({
      ...unpaid, actions: { ...unpaid.actions, canConfirmCash: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
    const arrived = {
      ...unpaid, arrivalStatus: "ARRIVED",
      actions: { ...unpaid.actions, canRecordArrival: false, canConfirmCash: true },
    };
    expect(validatePickupOrder(arrived, "STORE-1", "TX-1")).toBe(arrived);
    expect(() => validatePickupOrder({
      ...arrived, actions: { ...arrived.actions, canAllocateLots: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
    expect(() => validatePickupOrder({
      ...unpaid, state: "PAYMENT_SUCCESS", paymentStatus: "SUCCESS",
      actions: { ...unpaid.actions, canRecordArrival: false, canStartPreparation: true },
    }, "STORE-1", "TX-1")).toThrow("pickup.invalidResponse");
  });
});
