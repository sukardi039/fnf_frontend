import { request } from "./axios_helper";

const API_BASE = "/api";

export const listUoms = (params = {}) => {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  const qs = query.toString();
  return request("GET", `${API_BASE}/uoms${qs ? `?${qs}` : ""}`);
};

export const createUom = (data) =>
  request("POST", `${API_BASE}/uoms`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const updateUom = (uomId, data) =>
  request("PUT", `${API_BASE}/uoms/${uomId}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const listUomConversions = (params = {}) => {
  const query = new URLSearchParams();
  if (params.fromUom) query.set("fromUom", params.fromUom);
  if (params.toUom) query.set("toUom", params.toUom);
  if (params.active !== undefined) query.set("active", String(params.active));
  const qs = query.toString();
  return request("GET", `${API_BASE}/uom-conversions${qs ? `?${qs}` : ""}`);
};

export const createUomConversion = (data) =>
  request("POST", `${API_BASE}/uom-conversions`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
