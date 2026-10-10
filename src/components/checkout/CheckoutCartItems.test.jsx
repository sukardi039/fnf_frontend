import React from "react";
import PropTypes from "prop-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckoutCartItems from "./CheckoutCartItems";
import { listProducts } from "../catalog/productApi";

vi.mock("../catalog/productApi", () => ({ listProducts: vi.fn() }));

vi.mock("@mui/icons-material", () => ({ Delete: () => null, Inventory2: () => <span>Product placeholder</span> }));
vi.mock("../common", () => ({ EmptyState: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));
vi.mock("../../helpers/file_helper", () => ({
  getDisplayImageInfo: (picture) => typeof picture === "string"
    ? { imageUrl: picture } : { meta: picture },
  ThumbnailImg: ThumbnailMock,
}));

function ThumbnailMock({ alt, fileId }) {
  return <img alt={alt} src={`https://files.example/${fileId}`} />;
}
ThumbnailMock.propTypes = { alt: PropTypes.string, fileId: PropTypes.string };

describe("checkout fruit thumbnails", () => {
  beforeEach(() => {
    listProducts.mockReset();
    listProducts.mockResolvedValue({ data: { items: [], total: 0 } });
  });
  afterEach(cleanup);

  it("shows a fruit picture alongside editable quantity and removal controls", async () => {
    const onRemove = vi.fn();
    const onUpdateQuantity = vi.fn();
    const user = userEvent.setup();
    render(<CheckoutCartItems items={[{
      skuId: "APPLE", productName: "Apple", quantity: 2, uom: "EA",
      productPicture: "https://images.example/apple.jpg",
    }]} onRemove={onRemove} onUpdateQuantity={onUpdateQuantity} />);
    expect(screen.getByRole("img", { name: "Apple" })).toHaveAttribute("src", "https://images.example/apple.jpg");
    expect(screen.getByRole("spinbutton")).toHaveValue(2);
    await user.click(screen.getByRole("button", { name: "customer.cart.removeItem" }));
    expect(onRemove).toHaveBeenCalledWith("APPLE");
  });

  it("uses the shared file thumbnail handler for metadata pictures", () => {
    render(<CheckoutCartItems items={[{
      skuId: "ORANGE", productName: "Orange", quantity: 1, uom: "EA",
      productPicture: { id: "FILE-1", provider: "LOCAL" },
    }]} />);
    expect(screen.getByRole("img", { name: "Orange" })).toHaveAttribute("src", "https://files.example/FILE-1");
  });

  it("keeps older cart items with no catalog picture usable", async () => {
    render(<CheckoutCartItems items={[{
      skuId: "APPLE", productName: "Apple", quantity: 1, uom: "EA",
    }]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Product placeholder")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    await screen.findByText("Apple");
  });

  it("loads missing fruit pictures for an existing cart without changing its quantity", async () => {
    listProducts.mockResolvedValue({ data: { total: 1, items: [{
      skuId: "APPLE", productPicture: "https://images.example/apple.jpg",
    }] } });
    render(<CheckoutCartItems items={[{
      skuId: "APPLE", productName: "Apple", quantity: 5, uom: "EA",
    }]} />);
    expect(await screen.findByRole("img", { name: "Apple" })).toHaveAttribute("src", "https://images.example/apple.jpg");
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("reports catalog lookup failures while leaving the basket available", async () => {
    listProducts.mockRejectedValue(new Error("Unavailable"));
    render(<CheckoutCartItems items={[{
      skuId: "APPLE", productName: "Apple", quantity: 5, uom: "EA",
    }]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("customer.cart.picturesFailed");
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("finds a missing fruit picture beyond the first catalog page", async () => {
    listProducts.mockResolvedValueOnce({ data: { total: 101,
      items: Array.from({ length: 100 }, (_, index) => ({ skuId: `OTHER-${index}` })),
    } }).mockResolvedValueOnce({ data: { total: 101, items: [{
      skuId: "APPLE", productPicture: "https://images.example/apple.jpg",
    }] } });
    render(<CheckoutCartItems items={[{
      skuId: "APPLE", productName: "Apple", quantity: 5, uom: "EA",
    }]} />);
    expect(await screen.findByRole("img", { name: "Apple" })).toHaveAttribute("src", "https://images.example/apple.jpg");
    expect(listProducts).toHaveBeenLastCalledWith({ active: true, page: 1, pageSize: 100 });
  });
});
