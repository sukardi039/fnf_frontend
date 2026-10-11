const PENDING_KEY = "pda_payment_pending";
const DEFAULT_PAYMENT_APP_URL = "fnf-payment://pay";
const DEFAULT_CALLBACK_PATH = "/pda/payment-callback";
const PENDING_TTL_MS = 15 * 60 * 1000;

const requiredText = (value, name) => {
  const text = String(value || "").trim();
  if (!text || text.length > 2048) throw new Error(`pdaPayment.${name}Required`);
  return text;
};

const amountText = (value) => {
  const text = String(value ?? "").trim();
  if (!text || !Number.isFinite(Number(text)) || Number(text) <= 0) {
    throw new Error("pdaPayment.invalidAmount");
  }
  return text;
};

const paymentAppBaseUrl = () =>
  import.meta.env.VITE_PDA_PAYMENT_APP_URL || DEFAULT_PAYMENT_APP_URL;

const paymentCallbackPath = () =>
  import.meta.env.VITE_PDA_PAYMENT_CALLBACK_PATH || DEFAULT_CALLBACK_PATH;

export const buildPdaPaymentUrl = (order, origin) => {
  const transactionId = requiredText(order?.transactionId, "transactionId");
  const storeId = requiredText(order?.storeId, "storeId");
  const currency = requiredText(order?.currency, "currency");
  const amount = amountText(order?.amount);
  const callbackUrl = new URL(paymentCallbackPath(), origin);
  const target = new URL(paymentAppBaseUrl());
  target.searchParams.set("transactionId", transactionId);
  target.searchParams.set("storeId", storeId);
  target.searchParams.set("amount", amount);
  target.searchParams.set("currency", currency);
  target.searchParams.set("callbackUrl", callbackUrl.toString());

  return {
    url: target.toString(),
    context: {
      transactionId,
      storeId,
      amount,
      currency,
      startedAt: new Date().toISOString(),
    },
  };
};

export const startPdaPayment = (order) => {
  const payment = buildPdaPaymentUrl(order, window.location.origin);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(payment.context));
  window.location.assign(payment.url);
};

export const clearPdaPayment = () => sessionStorage.removeItem(PENDING_KEY);

const readPending = () => {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (!pending) throw new Error("pdaPayment.sessionMissing");
    if (!Number.isFinite(Date.parse(pending.startedAt)) ||
        Date.parse(pending.startedAt) + PENDING_TTL_MS <= Date.now()) {
      throw new Error("pdaPayment.sessionExpired");
    }
    return pending;
  } catch (error) {
    if (error?.message === "pdaPayment.sessionExpired") throw error;
    throw new Error("pdaPayment.sessionMissing");
  }
};

export const readPdaPaymentConfirmation = (search) => {
  const params = new URLSearchParams(search);
  const pending = readPending();
  const transactionId = requiredText(params.get("transactionId"), "transactionId");
  const storeId = requiredText(params.get("storeId"), "storeId");
  const paidAmount = amountText(params.get("paidAmount"));
  const currency = requiredText(params.get("currency"), "currency");
  if (transactionId !== pending.transactionId || storeId !== pending.storeId ||
      Number(paidAmount) !== Number(pending.amount) || currency !== pending.currency) {
    throw new Error("pdaPayment.confirmationMismatch");
  }
  if (params.get("status") !== "SUCCESS") {
    throw new Error("pdaPayment.notSuccessful");
  }
  const paidAt = requiredText(params.get("paidAt"), "paidAt");
  if (!Number.isFinite(Date.parse(paidAt))) throw new Error("pdaPayment.invalidPaidAt");

  return {
    provider: requiredText(params.get("provider"), "provider"),
    providerRef: requiredText(params.get("providerRef"), "providerRef"),
    paidAmount,
    currency,
    paidAt,
    proof: requiredText(params.get("proof"), "proof"),
  };
};

export const readPdaPaymentContext = () => {
  const pending = readPending();
  return {
    transactionId: pending.transactionId,
    storeId: pending.storeId,
  };
};
