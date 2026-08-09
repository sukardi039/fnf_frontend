import { request } from "./axios_helper";

export const listTransformationRecipes = (params = {}) => {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.companyId) query.set("companyId", params.companyId);
  const qs = query.toString();
  return request("GET", `/api/v1/transformation-recipes${qs ? `?${qs}` : ""}`);
};

export const createTransformation = (data) =>
  request("POST", "/api/v1/transformations", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const approveTransformation = (transformationId, data) =>
  request("POST", `/api/v1/transformations/${transformationId}/approve`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const activateTransformationRecipe = (recipeId) =>
  request("POST", `/api/v1/transformation-recipes/${recipeId}/activate`, null, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const listTransformations = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.recipeId) query.set("recipeId", params.recipeId);
  if (params.storeId) query.set("storeId", params.storeId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();
  return request("GET", `/api/v1/transformations${qs ? `?${qs}` : ""}`);
};
