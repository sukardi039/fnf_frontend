import { request } from "./axios_helper";

const API_BASE = "/api";

export const listTransformationRecipes = (params = {}) => {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.companyId) query.set("companyId", params.companyId);
  const qs = query.toString();
  return request("GET", `${API_BASE}/transformation-recipes${qs ? `?${qs}` : ""}`);
};

export const createTransformation = (data) =>
  request("POST", `${API_BASE}/transformations`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const approveTransformation = (transformationId, data) =>
  request("POST", `${API_BASE}/transformations/${transformationId}/approve`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const activateTransformationRecipe = (recipeId) =>
  request("POST", `${API_BASE}/transformation-recipes/${recipeId}/activate`, null, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const listTransformations = (params = {}, config = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.recipeId) query.set("recipeId", params.recipeId);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();
  return request("GET", `${API_BASE}/transformations${qs ? `?${qs}` : ""}`, null, config);
};
