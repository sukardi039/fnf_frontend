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

const COMPLETED_ORDER_STATES = new Set(["HANDED_OVER", "CANCELLED", "REFUNDED"]);

export const isCurrentCustomerOrder = (order) =>
  !COMPLETED_ORDER_STATES.has(order.state) &&
  (order.state !== "EXPIRED" || order.paymentStatus === "SUCCESS" ||
    ["IN_FLIGHT", "CHECKING"].includes(order.paymentResolutionStatus) ||
    Boolean(order.fulfilmentHoldReason));

export const listAllCustomerTransactions = async (customerId) => {
  let page = 0;
  const items = [];
  let total;
  do {
    const response = await listCustomerTransactions({ customerId, page, size: 100 });
    const data = response.data;
    if (!Array.isArray(data?.items) || !Number.isInteger(data.total) ||
        data.total < 0 || data.items.some((item) => typeof item?.state !== "string")) {
      throw new Error("Invalid customer order history response");
    }
    total = data.total;
    if (data.items.length === 0 && items.length < total) {
      throw new Error("Incomplete customer order history response");
    }
    items.push(...data.items);
    page += 1;
  } while (items.length < total);
  return items;
};

export const countIncompleteCustomerOrders = async (customerId) =>
  (await listAllCustomerTransactions(customerId)).filter(isCurrentCustomerOrder).length;
