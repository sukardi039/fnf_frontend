import { request } from "./axios_helper";

const API_BASE = "/api";

export const resolvePdaScan = (data) =>
  request("POST", `${API_BASE}/pda/scan/resolve`, data, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const confirmHandover = (transactionId, data) =>
  request("POST", `${API_BASE}/pda/transactions/${transactionId}/handover`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
