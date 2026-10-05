import React from "react";
import PropTypes from "prop-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StoreLocationContext } from "../../context/storeLocationContext";
import StaffCheckout from "./StaffCheckout";
import { request } from "../../helpers/axios_helper";
import { fetchActiveProducts } from "../catalog/productApi";

vi.mock("../../helpers/axios_helper", () => ({ request: vi.fn() }));
vi.mock("../catalog/productApi", () => ({ fetchActiveProducts: vi.fn() }));
vi.mock("@mui/icons-material", () => ({
  Add: () => null,
  Delete: () => null,
  Inventory2: () => null,
}));
vi.mock("../common", () => ({
  HeaderBar: HeaderBarMock,
  LoadingState: LoadingStateMock,
  EmptyState: EmptyStateMock,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

function HeaderBarMock({ title, subtitle }) {
  return <header><h1>{title}</h1><p>{subtitle}</p></header>;
}
HeaderBarMock.propTypes = { title: PropTypes.node, subtitle: PropTypes.node };

function LoadingStateMock({ message }) {
  return <p>{message}</p>;
}
LoadingStateMock.propTypes = { message: PropTypes.node };

function EmptyStateMock({ title, description }) {
  return <div><h2>{title}</h2><p>{description}</p></div>;
}
EmptyStateMock.propTypes = { title: PropTypes.node, description: PropTypes.node };

describe("PDA staff-assisted checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockReset();
    fetchActiveProducts.mockReset();
    fetchActiveProducts.mockResolvedValue({
      data: {
        items: [{
          skuId: "SKU-1",
          productName: "Apples",
          productCode: "APL",
          productPicture: "https://images.example/apples.jpg",
          uom: "EA",
        }],
      },
    });
    request
      .mockResolvedValueOnce({ data: { cartId: "CART-1", state: "OPEN" } })
      .mockResolvedValueOnce({
        data: {
          cartId: "CART-1",
          quoteId: "QUOTE-1",
          subtotal: "12.00",
          discount: "1.00",
          total: "11.00",
          currency: "MYR",
          expiresAt: "2026-10-05T12:00:00Z",
        },
      })
      .mockResolvedValueOnce({
        data: {
          transactionId: "TX-1",
          state: "PAYMENT_PENDING",
          amount: "11.00",
          currency: "MYR",
          payment: { redirectUrl: "https://payments.example/checkout/TX-1" },
        },
      });
  });

  afterEach(cleanup);

  it("shares the mobile browse/cart flow and starts channel-specific checkout", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StoreLocationContext.Provider value={{ storeId: "GPS-STORE-1", source: "gps" }}>
          <StaffCheckout pdaMode />
        </StoreLocationContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "staffCheckout.title" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Apples" }))
      .toHaveAttribute("src", "https://images.example/apples.jpg");
    expect(screen.getByText("pda.checkout.staffAssisted")).toBeInTheDocument();
    expect(screen.queryByLabelText("staffCheckout.channel")).not.toBeInTheDocument();

    await user.type(screen.getAllByRole("spinbutton")[0], "2");
    await user.click(screen.getByRole("button", { name: "customer.browse.add" }));
    expect(screen.getByText("2 EA")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "staffCheckout.getQuote" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenNthCalledWith(
      1,
      "POST",
      "/api/carts",
      { storeId: "GPS-STORE-1", channel: "STAFF_ASSISTED", customerId: null },
      expect.objectContaining({
        skipAuthRedirect: true,
        skipBackendErrorDialog: true,
      }),
    );

    expect(request).toHaveBeenNthCalledWith(
      2,
      "POST",
      "/api/carts/CART-1/items",
      { skuId: "SKU-1", quantity: 2 },
      expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
    );
    expect(await screen.findByText("MYR 11.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "staffCheckout.checkout" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(request).toHaveBeenNthCalledWith(
      3,
      "POST",
      "/api/checkout",
      {
        cartId: "CART-1",
        quoteId: "QUOTE-1",
        paymentMode: "CASH",
        channel: "STAFF_ASSISTED",
      },
      expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
    );
    expect(await screen.findByText("staffCheckout.completed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "staffCheckout.openPayment" }))
      .toHaveAttribute("href", "https://payments.example/checkout/TX-1");
  });

  it("keeps channel selection on web checkout while sharing the product/cart controls", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StoreLocationContext.Provider value={{ storeId: "GPS-STORE-2", source: "gps" }}>
          <StaffCheckout />
        </StoreLocationContext.Provider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", {
      name: "staffCheckout.channels.STORE_SELF_SELECT",
    }));
    await user.type(await screen.findByRole("spinbutton"), "1");
    await user.click(screen.getByRole("button", { name: "customer.browse.add" }));
    await user.click(screen.getByRole("button", { name: "staffCheckout.getQuote" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenNthCalledWith(
      1,
      "POST",
      "/api/carts",
      {
        storeId: "GPS-STORE-2",
        channel: "STORE_SELF_SELECT",
        customerId: null,
      },
      expect.any(Object),
    );
  });
});
