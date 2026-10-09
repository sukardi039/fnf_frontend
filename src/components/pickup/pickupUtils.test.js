import { describe, expect, it } from "vitest";
import { buildPickupAllocations, validatePickupOrder } from "./pickupUtils";
import { pickupOrder } from "./pickupTestData";

describe("pickup order validation", () => {
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
