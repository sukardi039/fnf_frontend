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
vi.mock("../catalog/productApi", () => ({ fetchActiveProducts: vi.fn(), listProducts: vi.fn() }));
vi.mock("@mui/icons-material", () => ({
  Add: () => null,
  Delete: () => null,
  Inventory2: () => null,
  PhotoCamera: () => null,
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
          state: "CASH_PENDING_CONFIRMATION",
          amount: "11.00",
          currency: "MYR",
        },
      })
      .mockResolvedValueOnce({
        data: {
          transactionId: "TX-1", state: "READY_FOR_HANDOVER", paymentStatus: "SUCCESS",
          confirmedBy: "STAFF-1", confirmedAt: "2026-10-09T04:00:00Z",
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
    expect(screen.getByRole("button", { name: "customer.browse.photoSearchAction" }))
      .toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "staffCheckout.openPayment" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "staffCheckout.newOrder" }))
      .toBeDisabled();
    expect(screen.getByText("staffCheckout.cashPending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "staffCheckout.confirmCash" })).toBeDisabled();
    await user.type(screen.getByLabelText(/staffCheckout.cashNote/), "Received MYR 11 in full");
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(await screen.findByText("staffCheckout.cashConfirmed")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(
      4, "POST", "/api/transactions/TX-1/confirm-cash",
      { confirmationNote: "Received MYR 11 in full" },
      expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
    );
    expect(screen.getByRole("button", { name: "staffCheckout.newOrder" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "staffCheckout.confirmCash" })).not.toBeInTheDocument();
    expect(request.mock.calls.filter((call) => call[1] === "/api/checkout")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "staffCheckout.newOrder" }));
    expect(await screen.findByRole("button", { name: "customer.browse.add" })).toBeInTheDocument();
    expect(screen.queryByText("staffCheckout.cashConfirmed")).not.toBeInTheDocument();
  });

  it("shows a clear error when checkout returns no transaction details", async () => {
    const user = userEvent.setup();
    request
      .mockReset()
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
      .mockResolvedValueOnce({ data: null });
    render(
      <MemoryRouter>
        <StoreLocationContext.Provider value={{ storeId: "GPS-STORE-1", source: "gps" }}>
          <StaffCheckout pdaMode />
        </StoreLocationContext.Provider>
      </MemoryRouter>,
    );

    await user.type(await screen.findByRole("spinbutton"), "1");
    await user.click(screen.getByRole("button", { name: "customer.browse.add" }));
    await user.click(screen.getByRole("button", { name: "staffCheckout.getQuote" }));
    await user.click(await screen.findByRole("button", { name: "staffCheckout.checkout" }));

    expect(await screen.findByText("staffCheckout.checkoutNoTransaction"))
      .toBeInTheDocument();
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
    expect(screen.queryByRole("option", {
      name: "staffCheckout.channels.MOBILE_ORDER",
    })).not.toBeInTheDocument();
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

  async function createPendingCash(user, paymentMode = "CASH") {
    render(
      <MemoryRouter>
        <StoreLocationContext.Provider value={{ storeId: "GPS-STORE-1" }}>
          <StaffCheckout />
        </StoreLocationContext.Provider>
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole("spinbutton"), "1");
    await user.click(screen.getByRole("button", { name: "customer.browse.add" }));
    await user.click(screen.getByRole("button", { name: "staffCheckout.getQuote" }));
    await screen.findByText("MYR 11.00");
    if (paymentMode !== "CASH") {
      await user.click(screen.getByRole("combobox", { name: "staffCheckout.paymentMode" }));
      await user.click(screen.getByRole("option", { name: `staffCheckout.paymentModes.${paymentMode}` }));
    }
    await user.click(screen.getByRole("button", { name: "staffCheckout.checkout" }));
    await screen.findByText("staffCheckout.completed");
  }

  it("confirms pay-at-counter cash on web checkout as well", async () => {
    const user = userEvent.setup();
    await createPendingCash(user, "PAY_AT_COUNTER");
    await user.type(screen.getByLabelText(/staffCheckout.cashNote/), "Full cash received at counter");
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(await screen.findByText("staffCheckout.cashConfirmed")).toBeInTheDocument();
    expect(request.mock.calls[2][2].paymentMode).toBe("PAY_AT_COUNTER");
    expect(request.mock.calls[3][1]).toBe("/api/transactions/TX-1/confirm-cash");
  });

  it("keeps failed cash confirmation pending and reuses the key on retry", async () => {
    request.mockReset()
      .mockResolvedValueOnce({ data: { cartId: "CART-1" } })
      .mockResolvedValueOnce({ data: {
        quoteId: "QUOTE-1", currency: "MYR", subtotal: "12.00", discount: "1.00",
        total: "11.00", expiresAt: "2026-10-09T05:00:00Z",
      } })
      .mockResolvedValueOnce({ data: { transactionId: "TX-1", state: "CASH_PENDING_CONFIRMATION", amount: "11.00", currency: "MYR" } })
      .mockRejectedValueOnce({ response: { data: { message: "Connection interrupted" } } })
      .mockResolvedValueOnce({ data: {
        transactionId: "TX-1", state: "READY_FOR_HANDOVER", paymentStatus: "SUCCESS",
        confirmedBy: "STAFF-1", confirmedAt: "2026-10-09T04:00:00Z",
      } });
    const user = userEvent.setup();
    await createPendingCash(user);
    await user.type(screen.getByLabelText(/staffCheckout.cashNote/), "Received full amount");
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(await screen.findByText("Connection interrupted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "staffCheckout.newOrder" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(await screen.findByText("staffCheckout.cashConfirmed")).toBeInTheDocument();
    expect(request.mock.calls[3][3].headers["Idempotency-Key"])
      .toBe(request.mock.calls[4][3].headers["Idempotency-Key"]);
    expect(request.mock.calls.filter((call) => call[1] === "/api/checkout")).toHaveLength(1);
  });

  it("does not accept confirmation for another transaction", async () => {
    const user = userEvent.setup();
    await createPendingCash(user);
    request.mockReset().mockResolvedValue({ data: {
      transactionId: "TX-OTHER", state: "READY_FOR_HANDOVER", paymentStatus: "SUCCESS",
      confirmedBy: "STAFF-1", confirmedAt: "2026-10-09T04:00:00Z",
    } });
    await user.type(screen.getByLabelText(/staffCheckout.cashNote/), "Cash received");
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(await screen.findByText("staffCheckout.cashInvalidResponse")).toBeInTheDocument();
    expect(screen.queryByText("staffCheckout.cashConfirmed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "staffCheckout.newOrder" })).toBeDisabled();
  });

  it("prevents double submission while cash confirmation is in flight", async () => {
    const user = userEvent.setup();
    await createPendingCash(user);
    let resolveConfirmation;
    request.mockReset().mockImplementation(() => new Promise((resolve) => { resolveConfirmation = resolve; }));
    await user.type(screen.getByLabelText(/staffCheckout.cashNote/), "Cash received");
    await user.dblClick(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "staffCheckout.cashConfirming" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "staffCheckout.newOrder" })).toBeDisabled();
    resolveConfirmation({ data: {
      transactionId: "TX-1", state: "READY_FOR_HANDOVER", paymentStatus: "SUCCESS",
      confirmedBy: "STAFF-1", confirmedAt: "2026-10-09T04:00:00Z",
    } });
    expect(await screen.findByText("staffCheckout.cashConfirmed")).toBeInTheDocument();
  });
});
