import { request } from "../../helpers/axios_helper";

/**
 * Single authoritative catalog service base path.
 * All product, product-format, label, and price-rule endpoints in this
 * module use this constant so the frontend never mixes versioned and
 * unversioned paths for the catalog domain.
 */
const CATALOG_API_BASE = "/api";

const catalogRequest = (method, path, data = null, options = {}) =>
  request(method, `${CATALOG_API_BASE}${path}`, data, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
    ...options,
  });

export const listProducts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.format) query.set("format", params.format);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined)
    query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return catalogRequest("GET", `/products${qs ? `?${qs}` : ""}`);
};

export const fetchActiveProducts = () => listProducts({ active: true });

export const fetchProductFormats = (active = true) => {
  const query = new URLSearchParams();
  if (active !== undefined) query.set("active", String(active));
  const qs = query.toString();
  return catalogRequest("GET", `/product-formats${qs ? `?${qs}` : ""}`);
};

export const createProductFormat = (data) =>
  catalogRequest("POST", "/product-formats", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const updateProductFormat = (formatCode, data) =>
  catalogRequest("PUT", `/product-formats/${formatCode}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const createProduct = (data) =>
  catalogRequest("POST", "/products", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const updateProduct = (productId, data) =>
  catalogRequest("PUT", `/products/${productId}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const generateSkuLabel = (data) =>
  catalogRequest("POST", "/labels", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const downloadSkuLabel = (labelRef) =>
  catalogRequest("GET", `/labels/${labelRef}/download`, null, {
    responseType: "blob",
  });

export const listPriceRules = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.skuId) query.set("skuId", params.skuId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined)
    query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return catalogRequest("GET", `/price-rules${qs ? `?${qs}` : ""}`);
};

export const getPriceRule = (ruleId) =>
  catalogRequest("GET", `/price-rules/${ruleId}`);

export const updatePriceRule = (ruleId, data) =>
  catalogRequest("PUT", `/price-rules/${ruleId}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const deletePriceRule = (ruleId) =>
  catalogRequest("DELETE", `/price-rules/${ruleId}`);

export const publishPriceRule = (ruleId) =>
  catalogRequest("POST", `/price-rules/${ruleId}/publish`, null, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const createPriceRule = (data) =>
  catalogRequest("POST", "/price-rules", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
