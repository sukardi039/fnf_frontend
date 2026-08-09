import { request } from "./axios_helper";

export const resolvePdaScan = (data) =>
  request("POST", "/api/v1/pda/scan/resolve", data, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const confirmHandover = (transactionId, data) =>
  request("POST", `/api/v1/pda/transactions/${transactionId}/handover`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
