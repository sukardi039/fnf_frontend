import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPdaPaymentUrl,
  clearPdaPayment,
  readPdaPaymentConfirmation,
} from "./pda_payment_helper";

const order = {
  transactionId: "TX-1",
  storeId: "STORE-1",
  amount: "12.50",
  currency: "SGD",
};

describe("PDA payment app bridge", () => {
  beforeEach(() => sessionStorage.clear());

  it("builds a payment app deep link with a same-origin callback", () => {
    const payment = buildPdaPaymentUrl(order, "https://pda.example");
    const url = new URL(payment.url);

    expect(url.protocol).toBe("fnf-payment:");
    expect(url.searchParams.get("transactionId")).toBe("TX-1");
    expect(url.searchParams.get("amount")).toBe("12.50");
    expect(url.searchParams.get("currency")).toBe("SGD");
    expect(url.searchParams.get("callbackUrl"))
      .toBe("https://pda.example/pda/payment-callback");
    expect(payment.context).toMatchObject(order);
  });

  it("reads a matching successful payment confirmation without trusting it as recorded", () => {
    sessionStorage.setItem("pda_payment_pending", JSON.stringify({
      ...order,
      startedAt: new Date().toISOString(),
    }));
    const query = new URLSearchParams({
      transactionId: "TX-1",
      storeId: "STORE-1",
      status: "SUCCESS",
      paidAmount: "12.50",
      currency: "SGD",
      paidAt: "2026-10-11T10:00:00Z",
      provider: "mockpay-pda",
      providerRef: "receipt-1",
      proof: "signed-receipt",
    });

    expect(readPdaPaymentConfirmation(query.toString())).toEqual({
      provider: "mockpay-pda",
      providerRef: "receipt-1",
      paidAmount: "12.50",
      currency: "SGD",
      paidAt: "2026-10-11T10:00:00Z",
      proof: "signed-receipt",
    });
    clearPdaPayment();
  });

  it("rejects confirmations for another order or without proof", () => {
    sessionStorage.setItem("pda_payment_pending", JSON.stringify({
      ...order,
      startedAt: new Date().toISOString(),
    }));
    const query = new URLSearchParams({
      transactionId: "TX-2",
      storeId: "STORE-1",
      status: "SUCCESS",
      paidAmount: "12.50",
      currency: "SGD",
      paidAt: "2026-10-11T10:00:00Z",
      provider: "mockpay-pda",
      providerRef: "receipt-1",
      proof: "signed-receipt",
    });
    expect(() => readPdaPaymentConfirmation(query.toString()))
      .toThrow("pdaPayment.confirmationMismatch");

    query.set("transactionId", "TX-1");
    query.delete("proof");
    expect(() => readPdaPaymentConfirmation(query.toString()))
      .toThrow("pdaPayment.proofRequired");
  });
});
