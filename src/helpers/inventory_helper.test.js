import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./axios_helper";
import { listLossEvents, listPurchaseLots } from "./inventory_helper";

vi.mock("./axios_helper", () => ({ request: vi.fn() }));

describe("inventory record list requests", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("loads a store-scoped purchase lot page with optional search", () => {
    listPurchaseLots({
      storeId: "store 1",
      page: 2,
      pageSize: 25,
      search: " orange ",
    });

    expect(request).toHaveBeenCalledWith(
      "GET",
      "/api/lots?storeId=store+1&page=2&pageSize=25&search=orange",
    );
  });

  it("loads a store-scoped loss event page without an empty search parameter", () => {
    listLossEvents({
      storeId: "store-2",
      page: 0,
      pageSize: 10,
      search: "  ",
    });

    expect(request).toHaveBeenCalledWith(
      "GET",
      "/api/loss-events?storeId=store-2&page=0&pageSize=10",
    );
  });
});
