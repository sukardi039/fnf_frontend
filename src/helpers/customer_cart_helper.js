import { request } from "./axios_helper";

export const createCustomerCart = (data) =>
  request("POST", "/api/v1/carts", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const addCustomerCartItem = (cartId, data) =>
  request("POST", `/api/v1/carts/${cartId}/items`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const checkoutCustomerCart = (data) =>
  request("POST", "/api/v1/checkout", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const listCustomerTransactions = (params = {}) => {
  const query = new URLSearchParams();
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.status) query.set("status", params.status);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();
  return request("GET", `/api/v1/transactions${qs ? `?${qs}` : ""}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};
