import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./axios_helper";
import { countIncompleteCustomerOrders, isCurrentCustomerOrder, listAllCustomerTransactions } from "./customer_cart_helper";

vi.mock("./axios_helper", () => ({ request: vi.fn() }));

describe("incomplete customer order count", () => {
  beforeEach(() => request.mockReset());

  it("counts all pages and excludes only terminal orders", async () => {
    request.mockResolvedValueOnce({ data: {
      total: 104,
      items: Array.from({ length: 100 }, (_, index) => ({
        state: ["PAYMENT_PENDING", "CASH_PENDING_CONFIRMATION", "PAYMENT_FAILED",
          "PAYMENT_SUCCESS", "READY_FOR_HANDOVER"][index % 5],
      })),
    } }).mockResolvedValueOnce({ data: {
      total: 104,
      items: ["HANDED_OVER", "CANCELLED", "REFUNDED", "EXPIRED"].map((state) => ({ state })),
    } });
    expect(await countIncompleteCustomerOrders("CUSTOMER-1")).toBe(100);
    expect(request.mock.calls[1][1]).toContain("customerId=CUSTOMER-1&page=1&size=100");
  });

  it("returns zero for empty history", async () => {
    request.mockResolvedValue({ data: { items: [], total: 0 } });
    expect(await countIncompleteCustomerOrders("CUSTOMER-1")).toBe(0);
  });
  it("counts overdue, held, unresolved payments and legacy paid-expired orders without reviving terminal orders", async () => {
    request.mockResolvedValue({ data: { total: 7, items: [
      { state: "PAYMENT_SUCCESS", paymentStatus: "SUCCESS", pickupTimingStatus: "OVERDUE" },
      { state: "PAYMENT_SUCCESS", paymentStatus: "SUCCESS", fulfilmentHoldReason: "LATE_PAYMENT" },
      { state: "PAYMENT_PENDING", paymentResolutionStatus: "CHECKING" },
      { state: "EXPIRED", paymentStatus: "SUCCESS" },
      { state: "EXPIRED", paymentStatus: "PENDING" },
      { state: "HANDED_OVER", paymentStatus: "SUCCESS" },
      { state: "REFUNDED", paymentStatus: "REFUNDED" },
    ] } });
    expect(await countIncompleteCustomerOrders("CUSTOMER-1")).toBe(4);
  });

  it("rejects malformed or truncated history", async () => {
    request.mockResolvedValueOnce({ data: { items: [{}], total: 1 } });
    await expect(countIncompleteCustomerOrders("CUSTOMER-1")).rejects.toThrow("Invalid");
    request.mockResolvedValueOnce({ data: { items: [], total: 1 } });
    await expect(countIncompleteCustomerOrders("CUSTOMER-1")).rejects.toThrow("Incomplete");
  });

  it.each([
    [{ state: "EXPIRED", paymentStatus: "PENDING", paymentResolutionStatus: "CHECKING" }, true],
    [{ state: "EXPIRED", paymentStatus: "PENDING", paymentResolutionStatus: "IN_FLIGHT" }, true],
    [{ state: "EXPIRED", fulfilmentHoldReason: "LATE_PAYMENT" }, true],
    [{ state: "PAYMENT_SUCCESS", paymentStatus: "SUCCESS", pickupExpiresAt: "2020-01-01T00:00:00Z" }, true],
    [{ state: "EXPIRED", paymentStatus: "FAILED", paymentResolutionStatus: "NONE" }, false],
    [{ state: "HANDED_OVER", paymentStatus: "SUCCESS", fulfilmentHoldReason: "QUALITY_REVIEW" }, false],
    [{ state: "CANCELLED", paymentResolutionStatus: "CHECKING" }, false],
    [{ state: "REFUNDED", paymentStatus: "SUCCESS" }, false],
  ])("classifies %j as current=%s", (order, expected) => {
    expect(isCurrentCustomerOrder(order)).toBe(expected);
  });

  it("loads mixed history across all backend pages before the views are paginated", async () => {
    request.mockResolvedValueOnce({ data: { total: 3, items: [
      { transactionId: "PAST-1", state: "HANDED_OVER" },
      { transactionId: "CURRENT-1", state: "PAYMENT_PENDING" },
    ] } }).mockResolvedValueOnce({ data: { total: 3, items: [
      { transactionId: "CURRENT-2", state: "EXPIRED", paymentStatus: "SUCCESS" },
    ] } });
    const orders = await listAllCustomerTransactions("CUSTOMER-1");
    expect(orders.map((order) => order.transactionId)).toEqual(["PAST-1", "CURRENT-1", "CURRENT-2"]);
    expect(orders.filter(isCurrentCustomerOrder)).toHaveLength(2);
    expect(request.mock.calls[1][1]).toContain("page=1&size=100");
    expect(request.mock.calls[1][3]).toMatchObject({ authScope: "customer" });
  });
});
