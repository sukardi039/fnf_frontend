import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StoreLocationContext } from "../../context/storeLocationContext";
import CustomerCart from "./CustomerCart";
import { WEEKDAYS } from "../../helpers/store_hours_helper";
import {
  createCustomerCart, addCustomerCartItem, checkoutCustomerCart,
} from "../../helpers/customer_cart_helper";

vi.mock("../../helpers/customer_cart_helper", () => ({
  createCustomerCart: vi.fn(), addCustomerCartItem: vi.fn(), checkoutCustomerCart: vi.fn(),
}));
vi.mock("../../helpers/pickup_helper", () => ({
  issueCustomerCollectionToken: vi.fn(), issueCustomerArrivalToken: vi.fn(),
}));
vi.mock("@mui/icons-material", () => ({ Delete: () => null }));
vi.mock("../common", () => ({ LoadingState: () => null, EmptyState: () => null }));
vi.mock("react-i18next", () => {
  const t = (key, values) => values ? `${key} ${Object.values(values).join(" ")}` : key;
  return { useTranslation: () => ({ t }) };
});

function renderCart(onClear = vi.fn(), storeName = "Fresh n Fresh 315", timezone = "Asia/Singapore",
  businessHours = Object.fromEntries(WEEKDAYS.map((day) => [day, [{ opensAt: "09:00", closesAt: "22:00" }]]))) {
  return render(
    <MemoryRouter>
      <StoreLocationContext.Provider value={{
        storeId: "STORE-315", store: { storeName, timezone, businessHours },
      }}>
        <CustomerCart
          items={[{ skuId: "APPLE", productName: "Apple", uom: "EA", quantity: 2 }]}
          onClear={onClear} onRemove={vi.fn()} onUpdateQuantity={vi.fn()}
        />
      </StoreLocationContext.Provider>
    </MemoryRouter>,
  );
}

const schedule = {
  pickupSlotStart: "2026-10-09T08:30:00.000Z",
  pickupSlotEnd: "2026-10-09T09:00:00.000Z",
  pickupExpiresAt: "2026-10-09T09:30:00.000Z",
  pickupTimezone: "Asia/Singapore",
};

describe("customer pickup checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T07:00:00Z"));
    createCustomerCart.mockResolvedValue({ data: { cartId: "CART-1" } });
    addCustomerCartItem.mockResolvedValue({ data: { quoteId: "QUOTE-1" } });
    checkoutCustomerCart.mockResolvedValue({
      data: {
        ...schedule,
        transactionId: "TX-1", state: "PAYMENT_PENDING", currency: "MYR", amount: "12.00",
        payment: { redirectUrl: "https://payments.example/tx-1" },
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("defaults to cash on arrival without exposing technical channel choices", () => {
    renderCart();
    expect(screen.getByText("customer.cart.pickupTitle")).toBeInTheDocument();
    expect(screen.getByText("customer.cart.pickupStore Fresh n Fresh 315")).toBeInTheDocument();
    expect(screen.getByText("customer.cart.payAtCollectionInstructions")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "customer.cart.paymentChoice" })).toBeInTheDocument();
    expect(screen.queryByLabelText("customer.cart.channel")).not.toBeInTheDocument();
    expect(screen.queryByText("customer.cart.delivery")).not.toBeInTheDocument();
  });

  it("always submits mobile order and electronic payment, and does not describe pending payment as success", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderCart(onClear);
    await user.click(screen.getByRole("combobox", { name: "customer.cart.paymentChoice" }));
    await user.click(screen.getByRole("option", { name: "customer.cart.payOnline" }));
    expect(screen.getByText("customer.cart.onlinePaymentMock")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByText("customer.cart.orderSubmitted TX-1 MYR 12.00 PAYMENT_PENDING"))
      .toBeInTheDocument();
    expect(createCustomerCart).toHaveBeenCalledWith({
      storeId: "STORE-315", channel: "MOBILE_ORDER", customerId: null,
    }, expect.any(String));
    expect(addCustomerCartItem).toHaveBeenCalledWith("CART-1", { skuId: "APPLE", quantity: 2 }, expect.any(String));
    expect(checkoutCustomerCart).toHaveBeenCalledWith({
      cartId: "CART-1", quoteId: "QUOTE-1", channel: "MOBILE_ORDER", paymentMode: "E_PAYMENT",
      pickupSlotStart: "2026-10-09T08:30:00.000Z",
    }, expect.any(String));
    expect(screen.getByText("customer.cart.paymentUnconfirmed")).toBeInTheDocument();
    expect(screen.getByText("customer.cart.paymentUnconfirmed").closest('[role="alert"]'))
      .toHaveClass("MuiAlert-standardInfo");
    expect(screen.getByRole("link", { name: "staffCheckout.openPayment" }))
      .toHaveAttribute("href", "https://payments.example/tx-1");
    expect(screen.getByRole("link", { name: "collection.viewOrders" })).toHaveAttribute("href", "/m/orders");
    expect(screen.queryByRole("button", { name: "collection.show" })).not.toBeInTheDocument();
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(checkoutCustomerCart).toHaveBeenCalledTimes(1);
  });

  it("exposes collection only for a paid and prepared order", async () => {
    checkoutCustomerCart.mockResolvedValue({
      data: {
        ...schedule,
        transactionId: "TX-1", state: "READY_FOR_HANDOVER", preparationStatus: "READY",
        currency: "MYR", amount: "12.00",
      },
    });
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByRole("button", { name: "collection.show" })).toBeInTheDocument();
    expect(screen.queryByText("customer.cart.paymentUnconfirmed")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-standardSuccess");
  });

  it("preserves the basket and surfaces backend policy rejection", async () => {
    checkoutCustomerCart.mockRejectedValue({ response: { data: { message: "Pickup checkout is unavailable" } } });
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderCart(onClear, undefined);
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByText("Pickup checkout is unavailable")).toBeInTheDocument();
    expect(onClear).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());
  });

  it("submits pay at collection on the original mobile order and offers arrival, not collection proof", async () => {
    checkoutCustomerCart.mockResolvedValue({
      data: {
        ...schedule,
        transactionId: "TX-1", state: "CASH_PENDING_CONFIRMATION",
        preparationStatus: "NOT_STARTED", currency: "MYR", amount: "12.00",
      },
    });
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByRole("button", { name: "arrival.show" })).toBeInTheDocument();
    expect(checkoutCustomerCart).toHaveBeenCalledWith({
      cartId: "CART-1", quoteId: "QUOTE-1", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
      pickupSlotStart: "2026-10-09T08:30:00.000Z",
    }, expect.any(String));
    expect(screen.queryByRole("button", { name: "collection.show" })).not.toBeInTheDocument();
    expect(screen.queryByText("customer.cart.paymentUnconfirmed")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-standardInfo");
    expect(createCustomerCart).toHaveBeenCalledTimes(1);
    expect(checkoutCustomerCart).toHaveBeenCalledTimes(1);
  });

  it("retries an interrupted checkout on the same cart and key instead of recreating the order", async () => {
    checkoutCustomerCart.mockRejectedValueOnce(new Error("Network interrupted"))
      .mockResolvedValueOnce({ data: {
        ...schedule,
        transactionId: "TX-1", state: "CASH_PENDING_CONFIRMATION", currency: "MYR", amount: "12.00",
      } });
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByText("Network interrupted")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "customer.cart.paymentChoice" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "customer.cart.pickupTime" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByRole("button", { name: "arrival.show" })).toBeInTheDocument();
    expect(createCustomerCart).toHaveBeenCalledTimes(1);
    expect(addCustomerCartItem).toHaveBeenCalledTimes(1);
    expect(checkoutCustomerCart).toHaveBeenCalledTimes(2);
    expect(checkoutCustomerCart.mock.calls[0]).toEqual(checkoutCustomerCart.mock.calls[1]);
  });

  it("offers 30-minute blocks and submits the customer-selected slot", async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByRole("combobox", { name: "customer.cart.pickupTime" }));
    expect(screen.getByRole("option", { name: "16:30 - 17:00" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "21:00 - 21:30" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "21:30 - 22:00" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "18:00 - 18:30" }));
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    await waitFor(() => expect(checkoutCustomerCart).toHaveBeenCalledWith(
      expect.objectContaining({ pickupSlotStart: "2026-10-09T10:00:00.000Z" }), expect.any(String),
    ));
  });

  it("disables same-day checkout after the last eligible slot", () => {
    vi.setSystemTime(new Date("2026-10-09T11:30:00.001Z"));
    renderCart();
    expect(screen.getByText("customer.cart.noPickupSlots")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "customer.cart.checkout" })).toBeDisabled();
    expect(createCustomerCart).not.toHaveBeenCalled();
  });

  it("blocks checkout for a store with no timezone", () => {
    renderCart(vi.fn(), "Fresh n Fresh 315", "");
    expect(screen.getByText("customer.cart.pickupHoursRequired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "customer.cart.checkout" })).toBeDisabled();
  });

  it("blocks checkout until weekly business hours are configured", () => {
    renderCart(vi.fn(), "Fresh n Fresh 315", "Asia/Singapore", null);
    expect(screen.getByText("customer.cart.pickupHoursRequired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "customer.cart.checkout" })).toBeDisabled();
  });

  it("revalidates the selected slot at checkout, not just when rendered", async () => {
    const user = userEvent.setup();
    renderCart();
    act(() => vi.setSystemTime(new Date("2026-10-09T07:00:01Z")));
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByText("customer.cart.pickupSlotUnavailable")).toBeInTheDocument();
    expect(createCustomerCart).not.toHaveBeenCalled();
  });

  it("reports missing backend schedule confirmation without permitting another order", async () => {
    checkoutCustomerCart.mockResolvedValue({ data: {
      transactionId: "TX-1", state: "CASH_PENDING_CONFIRMATION", currency: "MYR", amount: "12.00",
    } });
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByRole("button", { name: "customer.cart.checkout" }));
    expect(await screen.findByText("customer.cart.pickupScheduleUnconfirmed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "customer.cart.checkout" })).toBeDisabled();
    expect(checkoutCustomerCart).toHaveBeenCalledTimes(1);
  });
});
