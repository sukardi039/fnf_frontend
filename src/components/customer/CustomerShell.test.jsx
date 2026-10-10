import React from "react";
import PropTypes from "prop-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CustomerShell from "./CustomerShell";
import { countIncompleteCustomerOrders } from "../../helpers/customer_cart_helper";
import { clearCustomerSession } from "../../helpers/customer_helper";

vi.mock("../../helpers/customer_cart_helper", () => ({
  countIncompleteCustomerOrders: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));
vi.mock("@mui/icons-material", () => ({
  Storefront: () => null,
  ShoppingCart: () => null,
  ListAlt: () => null,
  Person: () => null,
}));
vi.mock("../../helpers/customer_helper", () => ({
  getCustomerInfo: () => ({ name: "Customer", email: "customer@example.com" }),
  registerCustomer: vi.fn(),
  loginCustomer: vi.fn(),
  storeCustomerSession: vi.fn(),
  clearCustomerSession: vi.fn(),
}));
vi.mock("../common/StoreScope", () => ({ default: StoreScopeMock }));
vi.mock("./CustomerAuth", () => ({ default: () => <div>Customer login</div> }));
vi.mock("./CustomerOrders", () => ({ default: () => null }));
vi.mock("./CustomerBrowse", () => ({ default: BrowseMock }));
vi.mock("./CustomerCart", () => ({ default: CartMock }));

function StoreScopeMock({ children }) {
  return <>{children}</>;
}
StoreScopeMock.propTypes = { children: PropTypes.node };

function BrowseMock({ onAddToCart }) {
  return (
    <>
      <button onClick={() => onAddToCart({
        skuId: "APPLE", productName: "Apple", uom: "EA", quantity: 3,
        productPicture: "https://images.example/apple.jpg",
      })}>
        Add apple
      </button>
      <button onClick={() => onAddToCart({
        skuId: "ORANGE", productName: "Orange", uom: "EA", quantity: 2,
      })}>
        Add orange
      </button>
    </>
  );
}
BrowseMock.propTypes = { onAddToCart: PropTypes.func.isRequired };

function CartMock({ onRemove, onUpdateQuantity, onClear }) {
  return (
    <>
      <button onClick={() => onUpdateQuantity("APPLE", 10)}>Change quantity</button>
      <button onClick={() => onUpdateQuantity("APPLE", 0)}>Zero quantity</button>
      <button onClick={() => onRemove("ORANGE")}>Remove orange</button>
      <button onClick={onClear}>Complete checkout</button>
    </>
  );
}
CartMock.propTypes = {
  onRemove: PropTypes.func.isRequired,
  onUpdateQuantity: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/m/browse"]}>
      <Routes>
        <Route path="/m/*" element={<CustomerShell />} />
      </Routes>
    </MemoryRouter>,
  );
}

function cartBadge() {
  return within(screen.getByRole("button", { name: /Cart$/ }));
}

describe("Customer mobile cart badge", () => {
  it("offers logout on the profile page and returns to customer login", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Profile" }));
    const profile = within(screen.getByRole("main"));
    expect(profile.getByText("customer@example.com")).toBeInTheDocument();
    await user.click(profile.getByRole("button", { name: "Logout" }));
    expect(clearCustomerSession).toHaveBeenCalledOnce();
    expect(screen.getByText("Customer login")).toBeInTheDocument();
    expect(screen.queryByText("customer@example.com")).not.toBeInTheDocument();
  });
  it("clears the displayed customer session and shows login immediately on mobile expiry", async () => {
    window.history.replaceState({}, "", "/m/browse");
    renderShell();
    await screen.findByRole("button", { name: "Add apple" });
    act(() => window.dispatchEvent(new CustomEvent("auth:expired", {
      detail: { interface: "MOBILE", loginPath: "/m/auth", handled: false },
    })));
    expect(screen.getByText("Customer login")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add apple" })).not.toBeInTheDocument();
  });
  beforeEach(() => {
    clearCustomerSession.mockClear();
    sessionStorage.clear();
    countIncompleteCustomerOrders.mockReset();
    countIncompleteCustomerOrders.mockResolvedValue(0);
  });
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("counts distinct lines, not quantities, and updates on removal", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.getByRole("button", { name: /Cart$/ }))
      .toHaveAccessibleName("Cart");

    await user.click(screen.getByRole("button", { name: "Add apple" }));
    expect(cartBadge().getByText("1")).toBeVisible();
    expect(JSON.parse(sessionStorage.getItem("customer_cart"))[0].productPicture)
      .toBe("https://images.example/apple.jpg");
    await user.click(screen.getByRole("button", { name: "Add apple" }));
    expect(cartBadge().getByText("1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add orange" }));
    expect(cartBadge().getByText("2")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Cart$/ }));
    await user.click(screen.getByRole("button", { name: "Change quantity" }));
    expect(cartBadge().getByText("2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove orange" }));
    expect(cartBadge().getByText("1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Zero quantity" }));
    expect(cartBadge().queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cart$/ }))
      .toHaveAccessibleName("Cart");
  });

  it("restores the exact line count from the saved cart, including above 99", async () => {
    sessionStorage.setItem("customer_cart", JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        skuId: `SKU-${index}`, productName: "Fruit", uom: "EA", quantity: 5,
      })),
    ));
    renderShell();
    expect(cartBadge().getByText("100")).toBeVisible();
    await waitFor(() => expect(countIncompleteCustomerOrders).toHaveBeenCalled());
  });

  it("hides the badge when checkout clears the cart", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Add apple" }));
    await user.click(screen.getByRole("button", { name: /Cart$/ }));
    await user.click(screen.getByRole("button", { name: "Complete checkout" }));
    expect(cartBadge().queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cart$/ }))
      .toHaveAccessibleName("Cart");
    expect(JSON.parse(sessionStorage.getItem("customer_cart"))).toEqual([]);
  });

  it("shows the exact incomplete order count and hides it after collection refresh", async () => {
    countIncompleteCustomerOrders.mockResolvedValue(101);
    renderShell();
    const orders = within(screen.getByRole("button", { name: /Orders$/ }));
    expect(await orders.findByText("101")).toBeVisible();
    countIncompleteCustomerOrders.mockResolvedValue(0);
    window.dispatchEvent(new Event("customer:orders:refresh"));
    await waitFor(() => expect(orders.queryByText("101")).not.toBeInTheDocument());
  });

  it("surfaces count failures instead of showing a stale or zero badge", async () => {
    countIncompleteCustomerOrders.mockRejectedValue(new Error("Unavailable"));
    renderShell();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update");
    expect(screen.getByRole("button", { name: /Orders$/ })).toHaveAccessibleName("Orders");
  });

  it("refreshes after checkout clears the basket and when the browser regains focus", async () => {
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(countIncompleteCustomerOrders).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Add apple" }));
    await user.click(screen.getByRole("button", { name: /Cart$/ }));
    countIncompleteCustomerOrders.mockResolvedValue(1);
    await user.click(screen.getByRole("button", { name: "Complete checkout" }));
    const orders = within(screen.getByRole("button", { name: /Orders$/ }));
    expect(await orders.findByText("1")).toBeVisible();
    countIncompleteCustomerOrders.mockResolvedValue(0);
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(orders.queryByText("1")).not.toBeInTheDocument());
  });
});
