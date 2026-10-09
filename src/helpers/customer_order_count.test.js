import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./axios_helper";
import { countIncompleteCustomerOrders } from "./customer_cart_helper";

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

  it("rejects malformed or truncated history", async () => {
    request.mockResolvedValueOnce({ data: { items: [{}], total: 1 } });
    await expect(countIncompleteCustomerOrders("CUSTOMER-1")).rejects.toThrow("Invalid");
    request.mockResolvedValueOnce({ data: { items: [], total: 1 } });
    await expect(countIncompleteCustomerOrders("CUSTOMER-1")).rejects.toThrow("Incomplete");
  });
});
