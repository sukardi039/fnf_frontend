import { request } from "./axios_helper";

const API_BASE = "/api";

export const createCustomerCart = (data, key = crypto.randomUUID()) =>
  request("POST", `${API_BASE}/carts`, data, {
    headers: { "Idempotency-Key": key },
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const addCustomerCartItem = (cartId, data, key = crypto.randomUUID()) =>
  request("POST", `${API_BASE}/carts/${cartId}/items`, data, {
    headers: { "Idempotency-Key": key },
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const checkoutCustomerCart = (data, key = crypto.randomUUID()) =>
  request("POST", `${API_BASE}/checkout`, data, {
    headers: { "Idempotency-Key": key },
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const listCustomerTransactions = (params = {}) => {
  const query = new URLSearchParams();
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.status) query.set("status", params.status);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();
  return request("GET", `${API_BASE}/transactions${qs ? `?${qs}` : ""}`, null, {
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });
};

const TERMINAL_ORDER_STATES = new Set([
  "HANDED_OVER", "CANCELLED", "REFUNDED", "EXPIRED",
]);

export const countIncompleteCustomerOrders = async (customerId) => {
  let page = 0;
  let count = 0;
  let received = 0;
  let total;
  do {
    const response = await listCustomerTransactions({ customerId, page, size: 100 });
    const data = response.data;
    if (!Array.isArray(data?.items) || !Number.isInteger(data.total) ||
        data.total < 0 || data.items.some((item) => typeof item?.state !== "string")) {
      throw new Error("Invalid customer order history response");
    }
    total = data.total;
    if (data.items.length === 0 && received < total) {
      throw new Error("Incomplete customer order history response");
    }
    count += data.items.filter((item) => !TERMINAL_ORDER_STATES.has(item.state)).length;
    received += data.items.length;
    page += 1;
  } while (received < total);
  return count;
};
