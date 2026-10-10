import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import useProductPictures from "./useProductPictures";
import { listProducts } from "../components/catalog/productApi";

vi.mock("../components/catalog/productApi", () => ({ listProducts: vi.fn() }));

describe("shared product picture lookup", () => {
  afterEach(() => { cleanup(); vi.resetAllMocks(); });

  it("skips lookup for supplied pictures and lines without SKU IDs", () => {
    const { result } = renderHook(() => useProductPictures([
      { skuId: "APPLE", productPicture: "https://images.example/apple.jpg" },
      { productName: "Legacy" },
    ]));
    expect(listProducts).not.toHaveBeenCalled();
    expect(result.current.pictureError).toBe(false);
  });

  it("deduplicates SKU requests and skips legitimate catalog products without a SKU", async () => {
    listProducts.mockResolvedValue({ data: { total: 2, items: [
      { productId: "P-NO-SKU", skuId: null },
      { skuId: "APPLE", productPicture: "https://images.example/apple.jpg" },
    ] } });
    const { result } = renderHook(() => useProductPictures([{ skuId: "APPLE" }, { skuId: "APPLE" }]));
    await waitFor(() => expect(result.current.catalogPictures.APPLE).toBe("https://images.example/apple.jpg"));
    expect(listProducts).toHaveBeenCalledTimes(1);
    expect(result.current.pictureError).toBe(false);
  });

  it("ignores late results after the visible SKU set changes", async () => {
    let resolveApple;
    listProducts.mockReturnValueOnce(new Promise((resolve) => { resolveApple = resolve; }))
      .mockResolvedValueOnce({ data: { total: 1, items: [
        { skuId: "ORANGE", productPicture: "orange.jpg" },
      ] } });
    const { result, rerender } = renderHook(({ items }) => useProductPictures(items), {
      initialProps: { items: [{ skuId: "APPLE" }] },
    });
    rerender({ items: [{ skuId: "ORANGE" }] });
    await waitFor(() => expect(result.current.catalogPictures.ORANGE).toBe("orange.jpg"));
    await act(async () => resolveApple({ data: { total: 1, items: [
      { skuId: "APPLE", productPicture: "apple.jpg" },
    ] } }));
    expect(result.current.catalogPictures).toEqual({ ORANGE: "orange.jpg" });
  });

  it("surfaces malformed catalog responses as errors", async () => {
    listProducts.mockResolvedValue({ data: { total: 1, items: [null] } });
    const { result } = renderHook(() => useProductPictures([{ skuId: "APPLE" }]));
    await waitFor(() => expect(result.current.pictureError).toBe(true));
    expect(result.current.catalogPictures).toEqual({});
  });
});
