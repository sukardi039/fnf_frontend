import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerOrders from "./CustomerOrders";
import { listCustomerTransactions } from "../../helpers/customer_cart_helper";

vi.mock("../../helpers/customer_cart_helper", () => ({ listCustomerTransactions: vi.fn() }));
vi.mock("../../helpers/customer_helper", () => ({ getCustomerInfo: () => ({ customerId: "CUSTOMER-1" }) }));
vi.mock("../../helpers/pickup_helper", () => ({
  issueCustomerCollectionToken: vi.fn(), issueCustomerArrivalToken: vi.fn(),
}));
vi.mock("../common", () => ({ LoadingState: () => null, EmptyState: () => null }));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("customer pickup history", () => {
  afterEach(() => { cleanup(); vi.resetAllMocks(); });

  it("shows preparation and collection actions only for eligible mobile orders", async () => {
    listCustomerTransactions.mockResolvedValue({
      data: { total: 3, items: [
        { transactionId: "MOBILE-1", channel: "MOBILE_ORDER", preparationStatus: "READY", state: "READY_FOR_HANDOVER", currency: "MYR", amount: 5 },
        { transactionId: "COUNTER-1", channel: "STAFF_ASSISTED", state: "READY_FOR_HANDOVER", currency: "MYR", amount: 5 },
        { transactionId: "COLLECTED-1", channel: "MOBILE_ORDER", state: "HANDED_OVER", currency: "MYR", amount: 5 },
      ] },
    });
    render(<CustomerOrders />);
    expect(await screen.findByText("pickup.status.READY")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "collection.show" })).toHaveLength(1);
    const mobileCard = screen.getByText("MOBILE-1").closest(".MuiCard-root");
    expect(within(mobileCard).getByRole("button", { name: "collection.show" })).toBeInTheDocument();
  });

  it("refreshes and pages customer-owned order history", async () => {
    listCustomerTransactions.mockResolvedValue({ data: { items: [], total: 21 } });
    const user = userEvent.setup();
    render(<CustomerOrders />);
    await user.click(await screen.findByRole("button", { name: "pickup.next" }));
    expect(listCustomerTransactions).toHaveBeenLastCalledWith({ customerId: "CUSTOMER-1", page: 1, size: 20 });
    await user.click(await screen.findByRole("button", { name: "pickup.refresh" }));
    expect(listCustomerTransactions).toHaveBeenCalledTimes(3);
  });

  it("shows arrival proof only for unpaid cash pickup awaiting arrival, not collection proof", async () => {
    listCustomerTransactions.mockResolvedValue({
      data: { total: 2, items: [
        {
          transactionId: "CASH-1", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
          state: "CASH_PENDING_CONFIRMATION", arrivalStatus: "EXPECTED",
          preparationStatus: "NOT_STARTED", currency: "MYR", amount: 5,
        },
        {
          transactionId: "CASH-2", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
          state: "CASH_PENDING_CONFIRMATION", arrivalStatus: "ARRIVED",
          preparationStatus: "NOT_STARTED", currency: "MYR", amount: 5,
        },
      ] },
    });
    render(<CustomerOrders />);
    expect(await screen.findByRole("button", { name: "arrival.show" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "arrival.show" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "collection.show" })).not.toBeInTheDocument();
    expect(screen.getByText("pickup.arrived")).toBeInTheDocument();
  });

  it("shows the scheduled deadline and does not describe expired orders as awaiting preparation", async () => {
    listCustomerTransactions.mockResolvedValue({ data: { total: 1, items: [{
      transactionId: "EXPIRED-1", channel: "MOBILE_ORDER", paymentMode: "PAY_AT_COUNTER",
      state: "EXPIRED", preparationStatus: "NOT_STARTED", currency: "SGD", amount: 9,
      pickupSlotStart: "2026-10-09T10:00:00Z", pickupSlotEnd: "2026-10-09T10:30:00Z",
      pickupExpiresAt: "2026-10-09T11:00:00Z", pickupTimezone: "Asia/Singapore",
    }] } });
    render(<CustomerOrders />);
    expect(await screen.findByText("customer.orders.expired")).toBeInTheDocument();
    expect(screen.getByText("customer.cart.pickupScheduled")).toBeInTheDocument();
    expect(screen.getByText("customer.cart.pickupDeadline")).toBeInTheDocument();
    expect(screen.queryByText("pickup.status.NOT_STARTED")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "arrival.show" })).not.toBeInTheDocument();
  });
});
