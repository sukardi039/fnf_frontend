import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PdaPaymentCallback from "./PdaPaymentCallback";
import { StoreLocationContext } from "../../context/storeLocationContext";
import { confirmPickupElectronicPayment } from "../../helpers/pickup_helper";
import { pickupOrder } from "../pickup/pickupTestData";

vi.mock("../../helpers/pickup_helper", () => ({
  confirmPickupElectronicPayment: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

const confirmationQuery = new URLSearchParams({
  transactionId: "TX-1",
  storeId: "STORE-1",
  status: "SUCCESS",
  paidAmount: "18.00",
  currency: "MYR",
  paidAt: "2026-10-11T10:00:00Z",
  provider: "mockpay-pda",
  providerRef: "receipt-1",
  proof: "signed-receipt",
});

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={[`/pda/payment-callback?${confirmationQuery}`]}>
      <StoreLocationContext.Provider value={{ storeId: "STORE-1" }}>
        <Routes>
          <Route path="/pda/payment-callback" element={<PdaPaymentCallback />} />
          <Route path="/pda/pickup" element={<div>Pickup destination</div>} />
        </Routes>
      </StoreLocationContext.Provider>
    </MemoryRouter>,
  );
}

describe("PDA payment callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem("pda_payment_pending", JSON.stringify({
      transactionId: "TX-1",
      storeId: "STORE-1",
      amount: "18.00",
      currency: "MYR",
      startedAt: new Date().toISOString(),
    }));
    confirmPickupElectronicPayment.mockResolvedValue({
      data: {
        ...structuredClone(pickupOrder),
        paymentMode: "E_PAYMENT",
        paymentStatus: "SUCCESS",
        state: "PAYMENT_SUCCESS",
      },
    });
  });
  afterEach(cleanup);

  it("forwards the payment app confirmation and returns to the pickup order", async () => {
    renderCallback();

    expect(await screen.findByText("Pickup destination")).toBeInTheDocument();
    expect(confirmPickupElectronicPayment).toHaveBeenCalledWith("TX-1", "STORE-1", {
      provider: "mockpay-pda",
      providerRef: "receipt-1",
      paidAmount: "18.00",
      currency: "MYR",
      paidAt: "2026-10-11T10:00:00Z",
      proof: "signed-receipt",
    }, expect.any(String));
    expect(sessionStorage.getItem("pda_payment_pending")).toBeNull();
  });

  it("does not submit a confirmation without the matching pending payment request", async () => {
    sessionStorage.clear();
    renderCallback();

    expect(await screen.findByText("pdaPayment.sessionMissing")).toBeInTheDocument();
    expect(confirmPickupElectronicPayment).not.toHaveBeenCalled();
  });
});
