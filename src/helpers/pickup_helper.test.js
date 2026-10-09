import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./axios_helper";
import {
  listPickupOrders, getPickupOrder, allocatePickupLots, preparePickupOrder,
  verifyPickupCollection, handoverPickupOrder, issueCustomerCollectionToken,
  recordPickupArrival, confirmPickupCash, issueCustomerArrivalToken,
} from "./pickup_helper";

vi.mock("./axios_helper", () => ({ request: vi.fn() }));

describe("pickup API helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends scoped server-side filters and pagination", () => {
    listPickupOrders({ storeId: "Store 1", preparationStatus: "READY", page: 2, size: 20 });
    expect(request).toHaveBeenCalledWith(
      "GET", "/api/pickup-orders?storeId=Store+1&page=2&size=20&preparationStatus=READY",
      null, { skipBackendErrorDialog: true },
    );
    getPickupOrder("TX/1", "STORE-1");
    expect(request).toHaveBeenLastCalledWith(
      "GET", "/api/pickup-orders/TX%2F1?storeId=STORE-1", null, { skipBackendErrorDialog: true },
    );
  });

  it("sends existing transaction mutations with caller-owned idempotency keys", () => {
    const allocations = [{ saleLineId: "LINE-1", lotId: "LOT-1", quantity: 2, uom: "EA" }];
    allocatePickupLots("TX-1", "STORE-1", allocations, "KEY-1");
    preparePickupOrder("TX-1", "STORE-1", "READY", "KEY-2");
    handoverPickupOrder("TX-1", "STORE-1", "TOKEN", "KEY-3");
    expect(request.mock.calls.map((call) => [call[1], call[2], call[3].headers])).toEqual([
      ["/api/pickup-orders/TX-1/lot-allocations?storeId=STORE-1", { allocations }, { "Idempotency-Key": "KEY-1" }],
      ["/api/pickup-orders/TX-1/preparation?storeId=STORE-1", { status: "READY" }, { "Idempotency-Key": "KEY-2" }],
      ["/api/pickup-orders/TX-1/handover?storeId=STORE-1", { qrToken: "TOKEN" }, { "Idempotency-Key": "KEY-3" }],
    ]);
    expect(request.mock.calls.every((call) => !call[1].includes("/carts"))).toBe(true);
  });

  it("verifies against a specific order and issues owner-authenticated collection tokens", () => {
    verifyPickupCollection("TX-1", "STORE-1", "TOKEN");
    expect(request).toHaveBeenLastCalledWith(
      "POST", "/api/pickup-orders/TX-1/verify?storeId=STORE-1", { qrToken: "TOKEN" },
      { skipBackendErrorDialog: true },
    );
    issueCustomerCollectionToken("TX-1");
    expect(request).toHaveBeenLastCalledWith(
      "POST", "/api/transactions/TX-1/collection-token", null,
      { skipAuthRedirect: true, skipBackendErrorDialog: true, authScope: "customer" },
    );
  });

  it("records arrival and cash against a scoped existing order, with separate arrival issuance", () => {
    recordPickupArrival("TX-1", "STORE-1", "ARRIVAL", "KEY-A");
    confirmPickupCash("TX-1", "STORE-1", "Received in full", "KEY-C");
    expect(request.mock.calls.map((call) => [call[1], call[2], call[3].headers])).toEqual([
      ["/api/pickup-orders/TX-1/arrival?storeId=STORE-1", { qrToken: "ARRIVAL" }, { "Idempotency-Key": "KEY-A" }],
      ["/api/pickup-orders/TX-1/confirm-cash?storeId=STORE-1", { confirmationNote: "Received in full" }, { "Idempotency-Key": "KEY-C" }],
    ]);
    issueCustomerArrivalToken("TX-1");
    expect(request).toHaveBeenLastCalledWith(
      "POST", "/api/transactions/TX-1/arrival-token", null,
      { skipAuthRedirect: true, skipBackendErrorDialog: true, authScope: "customer" },
    );
  });
});
