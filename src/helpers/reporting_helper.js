import { request } from "./axios_helper";

export const getDailySummary = (params = {}) => {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.storeId) query.set("storeId", params.storeId);
  const qs = query.toString();
  return request("GET", `/api/v1/reports/daily-summary${qs ? `?${qs}` : ""}`);
};

export const submitReconciliation = (data) =>
  request("POST", "/api/v1/reconciliations", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const finalizeReconciliation = (reconciliationId, data) =>
  request(
    "POST",
    `/api/v1/reconciliations/${reconciliationId}/finalize`,
    data,
    {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    },
  );

export const reopenReconciliation = (reconciliationId, data) =>
  request("POST", `/api/v1/reconciliations/${reconciliationId}/reopen`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
