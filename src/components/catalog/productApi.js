import { request } from "../../helpers/axios_helper";

export const listProducts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.format) query.set("format", params.format);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined)
    query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return request("GET", `/api/v1/products${qs ? `?${qs}` : ""}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};

export const fetchActiveProducts = () => listProducts({ active: true });

export const createProduct = (data) =>
  request("POST", "/api/v1/products", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const updateProduct = (productId, data) =>
  request("PUT", `/api/v1/products/${productId}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const generateSkuLabel = (data) =>
  request("POST", "/api/v1/labels", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const downloadSkuLabel = (labelRef) =>
  request("GET", `/api/v1/labels/${labelRef}/download`, null, {
    responseType: "blob",
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
