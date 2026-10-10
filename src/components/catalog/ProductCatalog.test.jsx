import React from "react";
import PropTypes from "prop-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ProductCatalog from "./ProductCatalog";
import { fetchProductFormats, listProducts } from "./productApi";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

vi.mock("./productApi", () => ({ listProducts: vi.fn(), fetchProductFormats: vi.fn() }));
vi.mock("../../hooks/useResponsiveLayout", () => ({ useResponsiveLayout: vi.fn() }));
vi.mock("@mui/icons-material", () => ({
  Inventory2: () => <span>Product placeholder</span>, Search: () => null,
  Edit: () => null, Delete: () => null, Visibility: () => null,
}));
vi.mock("../../helpers/file_helper", () => ({
  getDisplayImageInfo: (picture) => ({ imageUrl: picture }), ThumbnailImg: () => null,
}));
vi.mock("./ProductForm", () => ({ default: () => null }));
vi.mock("../common/HelpDialog", () => ({ default: () => null }));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("@mui/x-data-grid", () => ({ DataGrid: Grid }));
function Grid({ rows, columns }) {
  const pictureColumn = columns.find((column) => column.field === "productPicture");
  return <div>{rows.map((row) => (
    <div key={row.skuId}>{pictureColumn.renderCell({ row, value: row.productPicture })}</div>
  ))}</div>;
}
Grid.propTypes = { rows: PropTypes.array, columns: PropTypes.array };

vi.mock("../common", async () => {
  const { default: BlockListItem } = await import("../common/BlockListItem");
  return {
    BlockListItem, PageHeader: () => null, EmptyState: () => null, LoadingState: () => null,
    LoadMoreBlockList: Blocks,
  };
});
function Blocks({ items, renderItem }) {
  return <div>{items.map(renderItem)}</div>;
}
Blocks.propTypes = { items: PropTypes.array, renderItem: PropTypes.func };

describe("product maintenance shared thumbnails", () => {
  beforeEach(() => {
    fetchProductFormats.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({ data: { items: [
      { productId: "P-1", skuId: "SKU-1", productName: "Orange", currency: "SGD", price: 2,
        productPicture: "https://images.example/orange.jpg" },
    ] } });
  });
  afterEach(() => { cleanup(); vi.resetAllMocks(); });

  it.each([false, true])("uses the common thumbnail in block layout=%s", async (shouldUseBlockLayout) => {
    useResponsiveLayout.mockReturnValue({ shouldUseBlockLayout });
    render(<ProductCatalog />);
    const image = await screen.findByRole("img", { name: "Orange" });
    expect(image).toHaveAttribute("src", "https://images.example/orange.jpg");
    expect(image.parentElement).toHaveStyle({ width: "40px", height: "40px" });
  });
});
