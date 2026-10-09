import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PickupOrderDetails from "./PickupOrderDetails";
import { pickupOrder } from "./pickupTestData";
import { verifyPickupCollection, handoverPickupOrder } from "../../helpers/pickup_helper";

vi.mock("../../helpers/pickup_helper", () => ({
  allocatePickupLots: vi.fn(), preparePickupOrder: vi.fn(),
  verifyPickupCollection: vi.fn(), handoverPickupOrder: vi.fn(),
}));
vi.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

describe("pickup collection eligibility", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

  it("invalidates verification when the token expires or its text changes", async () => {
    vi.useFakeTimers();
    verifyPickupCollection.mockImplementation(async () => ({
      data: {
        transactionId: "TX-1", storeId: "STORE-1", verified: true,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
    }));
    render(
      <PickupOrderDetails
        order={{
          ...pickupOrder, preparationStatus: "READY",
          actions: { canAllocateLots: false, canStartPreparation: false, canMarkReady: false, canHandover: true },
        }}
        onChanged={vi.fn()} onClose={vi.fn()} onBusyChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("pickup.collectionToken");
    const verify = screen.getByRole("button", { name: "pickup.verify" });
    const handover = screen.getByRole("button", { name: "pickup.confirmHandover" });
    expect(handover).toBeDisabled();
    fireEvent.change(input, { target: { value: "TOKEN" } });
    await act(async () => fireEvent.click(verify));
    expect(handover).toBeEnabled();
    act(() => vi.advanceTimersByTime(1001));
    expect(handover).toBeDisabled();
    await act(async () => fireEvent.click(verify));
    expect(handover).toBeEnabled();
    fireEvent.change(input, { target: { value: "OTHER-TOKEN" } });
    expect(handover).toBeDisabled();
    expect(handoverPickupOrder).not.toHaveBeenCalled();
  });
});
