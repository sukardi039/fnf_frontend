import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StoreLocationContext } from "../../context/storeLocationContext";
import PickupOrders from "./PickupOrders";
import { pickupOrder } from "./pickupTestData";
import {
  listPickupOrders, getPickupOrder, allocatePickupLots, preparePickupOrder,
  verifyPickupCollection, handoverPickupOrder,
  recordPickupArrival, confirmPickupCash,
} from "../../helpers/pickup_helper";

vi.mock("../../helpers/pickup_helper", () => ({
  listPickupOrders: vi.fn(), getPickupOrder: vi.fn(), allocatePickupLots: vi.fn(),
  preparePickupOrder: vi.fn(), verifyPickupCollection: vi.fn(), handoverPickupOrder: vi.fn(),
  recordPickupArrival: vi.fn(), confirmPickupCash: vi.fn(),
}));
vi.mock("react-i18next", () => {
  const t = (key, values) => values?.transactionId ? `${key} ${values.transactionId}` : key;
  return { useTranslation: () => ({ t }) };
});

function shell(storeId = "STORE-1") {
  return (
    <MemoryRouter>
      <StoreLocationContext.Provider value={{ storeId }}>
        <PickupOrders />
      </StoreLocationContext.Provider>
    </MemoryRouter>
  );
}

describe("staff pickup orders", () => {
  let current;
  beforeEach(() => {
    vi.resetAllMocks();
    current = structuredClone(pickupOrder);
    listPickupOrders.mockImplementation(async ({ page, size }) => ({
      data: { items: current.state === "HANDED_OVER" ? [] : [current], page, size, total: 1 },
    }));
    getPickupOrder.mockImplementation(async () => ({ data: structuredClone(current) }));
    allocatePickupLots.mockImplementation(async (_, __, allocations) => {
      current.items[0].allocations = allocations;
      return { data: structuredClone(current) };
    });
    preparePickupOrder.mockImplementation(async (_, __, status) => {
      current.preparationStatus = status;
      current.actions = {
        canRecordArrival: false, canConfirmCash: false,
        canAllocateLots: status !== "READY", canStartPreparation: false,
        canMarkReady: status === "PREPARING", canHandover: status === "READY",
      };
      return { data: structuredClone(current) };
    });
    verifyPickupCollection.mockResolvedValue({
      data: {
        transactionId: "TX-1", storeId: "STORE-1", verified: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    });
    handoverPickupOrder.mockImplementation(async () => {
      current.state = "HANDED_OVER";
      current.actions = {
        canRecordArrival: false, canConfirmCash: false,
        canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: false,
      };
      return { data: structuredClone(current) };
    });
  });
  afterEach(cleanup);

  it("allocates split lots, prepares and hands over the original transaction only after token verification", async () => {
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    expect(await screen.findByText("APPLE: 3 EA")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.confirmHandover" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "pickup.lot" }));
    await user.click(screen.getAllByRole("option", { name: "pickup.lotOption" })[0]);
    await user.type(screen.getByRole("spinbutton"), "2");
    await user.click(screen.getByRole("button", { name: "pickup.addLot" }));
    await user.click(screen.getAllByRole("combobox", { name: "pickup.lot" })[1]);
    await user.click(screen.getAllByRole("option", { name: "pickup.lotOption" })[1]);
    await user.type(screen.getAllByRole("spinbutton")[1], "1");
    await user.click(screen.getByRole("button", { name: "pickup.saveAllocations" }));
    await waitFor(() => expect(allocatePickupLots).toHaveBeenCalledWith(
      "TX-1", "STORE-1",
      [
        { saleLineId: "LINE-1", lotId: "LOT-1", quantity: 2, uom: "EA" },
        { saleLineId: "LINE-1", lotId: "LOT-2", quantity: 1, uom: "EA" },
      ],
      expect.any(String),
    ));
    await user.click(await screen.findByRole("button", { name: "pickup.startPreparation" }));
    await user.click(await screen.findByRole("button", { name: "pickup.markReady" }));
    const confirm = await screen.findByRole("button", { name: "pickup.confirmHandover" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("pickup.collectionToken"), "TOKEN");
    await user.click(screen.getByRole("button", { name: "pickup.verify" }));
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    expect(await screen.findByText("pickup.transactionState: HANDED_OVER")).toBeInTheDocument();
    expect(handoverPickupOrder).toHaveBeenCalledWith("TX-1", "STORE-1", "TOKEN", expect.any(String));
    expect(preparePickupOrder.mock.calls.map((call) => call[2])).toEqual(["PREPARING", "READY"]);
  });

  it("rejects a collection token belonging to a different transaction", async () => {
    current.preparationStatus = "READY";
    current.actions = {
      canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: true,
    };
    verifyPickupCollection.mockResolvedValue({
      data: { transactionId: "TX-OTHER", storeId: "STORE-1", verified: true, expiresAt: new Date(Date.now() + 60000).toISOString() },
    });
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    await user.type(await screen.findByLabelText("pickup.collectionToken"), "TOKEN");
    await user.click(screen.getByRole("button", { name: "pickup.verify" }));
    expect(await screen.findByText("pickup.invalidVerification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pickup.confirmHandover" })).toBeDisabled();
    expect(handoverPickupOrder).not.toHaveBeenCalled();
  });

  it("reuses the idempotency key for an unchanged failed preparation retry", async () => {
    preparePickupOrder.mockRejectedValue(new Error("Network unavailable"));
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    await user.click(await screen.findByRole("button", { name: "pickup.startPreparation" }));
    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "pickup.startPreparation" }));
    await waitFor(() => expect(preparePickupOrder).toHaveBeenCalledTimes(2));
    expect(preparePickupOrder.mock.calls[0][3]).toBe(preparePickupOrder.mock.calls[1][3]);
  });

  it("rejects incorrectly scoped queue responses", async () => {
    current.storeId = "STORE-OTHER";
    render(shell());
    expect(await screen.findByText("pickup.invalidResponse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.openOrder TX-1" })).not.toBeInTheDocument();
  });

  it("requires verified arrival and cash payment before preparing a pay-at-collection order", async () => {
    current = {
      ...current, paymentMode: "PAY_AT_COUNTER", preparationPolicy: "ON_ARRIVAL",
      arrivalStatus: "EXPECTED", state: "CASH_PENDING_CONFIRMATION", paymentStatus: "PENDING",
      actions: {
        canRecordArrival: true, canConfirmCash: false,
        canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: false,
      },
    };
    recordPickupArrival.mockImplementation(async () => {
      current.arrivalStatus = "ARRIVED";
      current.actions.canRecordArrival = false;
      current.actions.canConfirmCash = true;
      return { data: structuredClone(current) };
    });

    confirmPickupCash.mockImplementation(async () => {
      current.paymentStatus = "SUCCESS";
      current.state = "PAYMENT_SUCCESS";
      current.actions.canConfirmCash = false;
      current.actions.canStartPreparation = true;
      current.actions.canAllocateLots = true;
      return { data: structuredClone(current) };
    });
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    await screen.findByLabelText("pickup.arrivalToken");
    expect(screen.getAllByText("pickup.awaitingArrival")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "pickup.startPreparation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "staffCheckout.confirmCash" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("pickup.arrivalToken"), "ARRIVAL-TOKEN");
    await user.click(screen.getByRole("button", { name: "pickup.recordArrival" }));
    const cash = await screen.findByRole("button", { name: "staffCheckout.confirmCash" });
    expect(cash).toBeDisabled();
    expect(screen.queryByRole("button", { name: "pickup.startPreparation" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/staffCheckout.cashNote/), "Full amount received");
    await user.click(cash);
    const prepare = await screen.findByRole("button", { name: "pickup.startPreparation" });
    expect(screen.queryByRole("button", { name: "pickup.confirmHandover" })).not.toBeInTheDocument();
    expect(recordPickupArrival).toHaveBeenCalledWith("TX-1", "STORE-1", "ARRIVAL-TOKEN", expect.any(String));
    expect(confirmPickupCash).toHaveBeenCalledWith("TX-1", "STORE-1", "Full amount received", expect.any(String));
    expect(prepare).toBeEnabled();
    await user.click(screen.getByRole("combobox", { name: "pickup.lot" }));
    await user.click(screen.getAllByRole("option", { name: "pickup.lotOption" })[1]);
    await user.type(screen.getByRole("spinbutton"), "3");
    await user.click(screen.getByRole("button", { name: "pickup.saveAllocations" }));
    await user.click(await screen.findByRole("button", { name: "pickup.startPreparation" }));
    await user.click(await screen.findByRole("button", { name: "pickup.markReady" }));
    await user.type(await screen.findByLabelText("pickup.collectionToken"), "COLLECTION-TOKEN");
    await user.click(screen.getByRole("button", { name: "pickup.verify" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "pickup.confirmHandover" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "pickup.confirmHandover" }));
    expect(await screen.findByText("pickup.transactionState: HANDED_OVER")).toBeInTheDocument();
    expect(handoverPickupOrder).toHaveBeenCalledWith("TX-1", "STORE-1", "COLLECTION-TOKEN", expect.any(String));
  });

  it("does not unlock preparation when cash receipt fails and reuses the retry key", async () => {
    current = {
      ...current, paymentMode: "PAY_AT_COUNTER", preparationPolicy: "ON_ARRIVAL",
      arrivalStatus: "ARRIVED", state: "CASH_PENDING_CONFIRMATION", paymentStatus: "PENDING",
      actions: {
        canRecordArrival: false, canConfirmCash: true, canAllocateLots: false,
        canStartPreparation: false, canMarkReady: false, canHandover: false,
      },
    };
    confirmPickupCash.mockRejectedValue(new Error("Receipt could not be confirmed"));
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    await user.type(await screen.findByLabelText(/staffCheckout.cashNote/), "Full amount received");
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    expect(await screen.findByText("Receipt could not be confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.startPreparation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.confirmHandover" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "staffCheckout.confirmCash" }));
    await waitFor(() => expect(confirmPickupCash).toHaveBeenCalledTimes(2));
    expect(confirmPickupCash.mock.calls[0]).toEqual(confirmPickupCash.mock.calls[1]);
  });

  it("keeps cash and preparation unavailable when arrival verification fails", async () => {
    current = {
      ...current, paymentMode: "PAY_AT_COUNTER", preparationPolicy: "ON_ARRIVAL",
      arrivalStatus: "EXPECTED", state: "CASH_PENDING_CONFIRMATION", paymentStatus: "PENDING",
      actions: {
        canRecordArrival: true, canConfirmCash: false, canAllocateLots: false,
        canStartPreparation: false, canMarkReady: false, canHandover: false,
      },
    };
    recordPickupArrival.mockRejectedValue({ response: { data: { message: "Arrival token expired" } } });
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    await user.type(await screen.findByLabelText("pickup.arrivalToken"), "OLD");
    await user.click(screen.getByRole("button", { name: "pickup.recordArrival" }));
    expect(await screen.findByText("Arrival token expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "staffCheckout.confirmCash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.startPreparation" })).not.toBeInTheDocument();
    expect(confirmPickupCash).not.toHaveBeenCalled();
  });

  it("filters and pages the store queue on the server", async () => {
    listPickupOrders.mockImplementation(async ({ page, size }) => ({
      data: { items: [current], page, size, total: 21 },
    }));
    const user = userEvent.setup();
    render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.next" }));
    await waitFor(() => expect(listPickupOrders).toHaveBeenLastCalledWith({
      storeId: "STORE-1", preparationStatus: "", page: 1, size: 20,
    }));
    await user.click(screen.getByRole("combobox", { name: "pickup.filter" }));
    await user.click(screen.getByRole("option", { name: "pickup.status.READY" }));
    await waitFor(() => expect(listPickupOrders).toHaveBeenLastCalledWith({
      storeId: "STORE-1", preparationStatus: "READY", page: 0, size: 20,
    }));
  });

  it("clears details and ignores late responses when the selected store changes", async () => {
    let resolveOld;
    getPickupOrder.mockReturnValue(new Promise((resolve) => { resolveOld = resolve; }));
    const user = userEvent.setup();
    const view = render(shell());
    await user.click(await screen.findByRole("button", { name: "pickup.openOrder TX-1" }));
    await waitFor(() => expect(getPickupOrder).toHaveBeenCalled());
    current = { ...current, storeId: "STORE-2", transactionId: "TX-2" };
    view.rerender(shell("STORE-2"));
    resolveOld({ data: pickupOrder });
    expect(await screen.findByRole("button", { name: "pickup.openOrder TX-2" })).toBeInTheDocument();
    expect(screen.queryByText("APPLE: 3 EA")).not.toBeInTheDocument();
    expect(listPickupOrders).toHaveBeenLastCalledWith({
      storeId: "STORE-2", preparationStatus: "", page: 0, size: 20,
    });
  });
});
