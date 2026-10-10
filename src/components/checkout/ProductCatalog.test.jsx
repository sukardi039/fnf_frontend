import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductCatalog from "./ProductCatalog";
import { fetchActiveProducts, matchProductsByImage } from "../catalog/productApi";

vi.mock("../catalog/productApi", () => ({
  fetchActiveProducts: vi.fn(),
  matchProductsByImage: vi.fn(),
}));
vi.mock("@mui/icons-material", () => ({
  Add: () => null,
  Inventory2: () => null,
  PhotoCamera: () => null,
  Undo: () => null,
}));
vi.mock("../common", () => ({
  EmptyState: () => null,
  LoadingState: () => null,
}));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("ProductCatalog photo search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchActiveProducts.mockResolvedValue({ data: { items: [] } });
    matchProductsByImage.mockResolvedValue({
      data: {
        matches: [{
          skuId: "SKU-APPLE",
          productName: "Fuji Apple",
          productCode: "APL",
          productPicture: "https://images.example/apple.jpg",
          uom: "EA",
          similarity: 0.91,
        }],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows photo matches as suggestions and adds only the confirmed product", async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    const { container } = render(
      <ProductCatalog
        storeId="GPS-STORE-1"
        onAddToCart={onAddToCart}
      />,
    );

    const photo = new File(["fruit-photo"], "apple.png", { type: "image/png" });
    await screen.findByRole("button", { name: "customer.browse.photoSearchAction" });
    expect(screen.queryByRole("button", { name: "customer.browse.choosePhoto" }))
      .not.toBeInTheDocument();
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [photo] },
    });

    await waitFor(() => {
      expect(matchProductsByImage).toHaveBeenCalledWith(photo, "GPS-STORE-1");
    });
    expect(screen.getByRole("button", { name: "customer.browse.clearPhoto" }))
      .toBeInTheDocument();
    expect(await screen.findByText("Fuji Apple")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fuji Apple" }))
      .toHaveAttribute("src", "https://images.example/apple.jpg");

    await user.type(screen.getByRole("spinbutton"), "2");
    await user.click(screen.getByRole("button", { name: "customer.browse.add" }));
    expect(onAddToCart).toHaveBeenCalledWith({
      skuId: "SKU-APPLE",
      productName: "Fuji Apple",
      productPicture: "https://images.example/apple.jpg",
      uom: "EA",
      quantity: 2,
    });
  });

  it("opens the photo picker from the search-field camera icon", async () => {
    const user = userEvent.setup();
    const inputClick = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<ProductCatalog enablePhotoSearch storeId="GPS-STORE-1" />);

    await user.click(
      await screen.findByRole("button", {
        name: "customer.browse.photoSearchAction",
      }),
    );

    expect(inputClick).toHaveBeenCalledOnce();
  });

  it("uses the first UOM-specific spinner step while accepting decimal quantities", async () => {
    fetchActiveProducts.mockResolvedValueOnce({
      data: {
        items: [
          { skuId: "SKU-WHOLE", productName: "Whole Fruit", productCode: "WHOLE", uom: "WHOLE" },
          { skuId: "SKU-G", productName: "Fruit by Gram", productCode: "GRAM", uom: "g" },
          { skuId: "SKU-CUP", productName: "Fruit Cup", productCode: "CUP", uom: "cup" },
          { skuId: "SKU-CC", productName: "Fruit by CC", productCode: "CC", uom: "cc" },
          { skuId: "SKU-ML", productName: "Fruit by ML", productCode: "ML", uom: "ml" },
          { skuId: "SKU-KG", productName: "Fruit by KG", productCode: "KG", uom: "kg" },
          { skuId: "SKU-L", productName: "Fruit by L", productCode: "L", uom: "l" },
        ],
      },
    });
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    render(<ProductCatalog onAddToCart={onAddToCart} />);

    const quantities = await screen.findAllByRole("spinbutton");
    expect(quantities.map((input) => input.step)).toEqual([
      "1", "1", "1", "1", "1", "0.1", "0.1",
    ]);
    expect(quantities.map((input) => input.min)).toEqual([
      "0", "0", "0", "0", "0", "0", "0",
    ]);
    quantities[5].stepUp();
    expect(quantities[5]).toHaveValue(0.1);
    quantities[0].stepUp();
    expect(quantities[0]).toHaveValue(1);

    await user.type(quantities[5], "0.01");
    await user.click(screen.getAllByRole("button", { name: "customer.browse.add" })[5]);

    expect(onAddToCart).toHaveBeenCalledWith({
      skuId: "SKU-KG",
      productName: "Fruit by KG",
      uom: "kg",
      quantity: 0.01,
    });
  });

  it("clears the active photo and restores the catalog when the camera is clicked", async () => {
    fetchActiveProducts.mockResolvedValueOnce({
      data: {
        items: [{
          skuId: "SKU-CATALOG",
          productName: "Catalog Apple",
          productCode: "APL-2",
          uom: "EA",
        }],
      },
    });
    const user = userEvent.setup();
    const { container } = render(
      <ProductCatalog enablePhotoSearch storeId="GPS-STORE-1" />,
    );
    const photo = new File(["fruit-photo"], "apple.jpg", { type: "image/jpeg" });
    await screen.findByRole("button", { name: "customer.browse.photoSearchAction" });
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [photo] },
    });
    await waitFor(() => {
      expect(matchProductsByImage).toHaveBeenCalledWith(photo, "GPS-STORE-1");
    });
    await user.click(screen.getByRole("button", { name: "customer.browse.clearPhoto" }));
    expect(screen.getByRole("button", { name: "customer.browse.photoSearchAction" }))
      .toBeInTheDocument();
    expect(screen.queryByText("customer.browse.photoMatchHint")).not.toBeInTheDocument();
    expect(screen.getByText("Catalog Apple")).toBeInTheDocument();
  });

  it("restores normal browsing when the match service returns no candidates", async () => {
    matchProductsByImage.mockResolvedValueOnce({ data: { matches: [] } });
    const user = userEvent.setup();
    const { container } = render(
      <ProductCatalog storeId="GPS-STORE-1" />,
    );

    const photo = new File(["fruit-photo"], "fruit.jpg", { type: "image/jpeg" });
    await screen.findByRole("button", { name: "customer.browse.photoSearchAction" });
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [photo] },
    });
    await waitFor(() => {
      expect(matchProductsByImage).toHaveBeenCalledWith(photo, "GPS-STORE-1");
    });
    expect(screen.getByRole("button", { name: "customer.browse.clearPhoto" }))
      .toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "customer.browse.clearPhoto" }));
    expect(screen.getByRole("button", { name: "customer.browse.photoSearchAction" }))
      .toBeInTheDocument();
    expect(screen.queryByText("customer.browse.photoMatchHint")).not.toBeInTheDocument();
  });
});
