import { request } from "./axios_helper";

export const listUoms = (params = {}) => {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  const qs = query.toString();
  return request("GET", `/api/v1/uoms${qs ? `?${qs}` : ""}`);
};

export const createUom = (data) =>
  request("POST", "/api/v1/uoms", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const updateUom = (uomId, data) =>
  request("PUT", `/api/v1/uoms/${uomId}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const listUomConversions = (params = {}) => {
  const query = new URLSearchParams();
  if (params.fromUom) query.set("fromUom", params.fromUom);
  if (params.toUom) query.set("toUom", params.toUom);
  if (params.active !== undefined) query.set("active", String(params.active));
  const qs = query.toString();
  return request("GET", `/api/v1/uom-conversions${qs ? `?${qs}` : ""}`);
};

export const createUomConversion = (data) =>
  request("POST", "/api/v1/uom-conversions", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
