import { request } from "./axios_helper";

const API_BASE = "/api";

export const getDailySummary = (params = {}) => {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.storeId) query.set("storeId", params.storeId);
  const qs = query.toString();
  return request("GET", `${API_BASE}/reports/daily-summary${qs ? `?${qs}` : ""}`);
};

export const submitReconciliation = (data) =>
  request("POST", `${API_BASE}/reconciliations`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

export const finalizeReconciliation = (reconciliationId, data) =>
  request(
    "POST",
    `${API_BASE}/reconciliations/${reconciliationId}/finalize`,
    data,
    {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    },
  );

export const reopenReconciliation = (reconciliationId, data) =>
  request("POST", `${API_BASE}/reconciliations/${reconciliationId}/reopen`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
