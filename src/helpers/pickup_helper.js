import { request } from "./axios_helper";

const options = { skipBackendErrorDialog: true };
const orderPath = (transactionId) =>
  `/api/pickup-orders/${encodeURIComponent(transactionId)}`;
const scope = (storeId) => `?${new URLSearchParams({ storeId })}`;
const mutate = (path, data, key) =>
  request("POST", path, data, {
    ...options,
    headers: { "Idempotency-Key": key },
  });

export const listPickupOrders = ({ storeId, queueView, preparationStatus, pickupTimingStatus, page = 0, size = 20 }) => {
  const query = new URLSearchParams({ storeId, page: String(page), size: String(size) });
  if (queueView) query.set("queueView", queueView);
  if (preparationStatus) query.set("preparationStatus", preparationStatus);
  if (pickupTimingStatus) query.set("pickupTimingStatus", pickupTimingStatus);
  return request("GET", `/api/pickup-orders?${query}`, null, options);
};

export const getPickupOrder = (transactionId, storeId) =>
  request("GET", `${orderPath(transactionId)}${scope(storeId)}`, null, options);

export const reconcilePickupOrder = (transactionId, storeId, review, key) =>
  mutate(`${orderPath(transactionId)}/reconciliation${scope(storeId)}`, review, key);

export const allocatePickupLots = (transactionId, storeId, allocations, key) =>
  mutate(`${orderPath(transactionId)}/lot-allocations${scope(storeId)}`, { allocations }, key);

export const preparePickupOrder = (transactionId, storeId, status, key) =>
  mutate(`${orderPath(transactionId)}/preparation${scope(storeId)}`, { status }, key);

export const recordPickupArrival = (transactionId, storeId, qrToken, key) =>
  mutate(`${orderPath(transactionId)}/arrival${scope(storeId)}`, { qrToken }, key);

export const confirmPickupCash = (transactionId, storeId, confirmationNote, key) =>
  mutate(`${orderPath(transactionId)}/confirm-cash${scope(storeId)}`, { confirmationNote }, key);

export const issueCustomerArrivalToken = (transactionId) =>
  request("POST", `/api/transactions/${encodeURIComponent(transactionId)}/arrival-token`, null, {
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const verifyPickupCollection = (transactionId, storeId, qrToken) =>
  request("POST", `${orderPath(transactionId)}/verify${scope(storeId)}`, { qrToken }, options);

export const handoverPickupOrder = (transactionId, storeId, qrToken, key) =>
  mutate(`${orderPath(transactionId)}/handover${scope(storeId)}`, { qrToken }, key);

export const issueCustomerCollectionToken = (transactionId) =>
  request("POST", `/api/transactions/${encodeURIComponent(transactionId)}/collection-token`, null, {
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });
