import { request, setAuthHeader } from "./axios_helper";

export const registerCustomer = (data) =>
  request("POST", "/api/v1/auth/customers/register", data, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const loginCustomer = (data) =>
  request("POST", "/api/v1/auth/customers/login", data, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const storeCustomerSession = (response) => {
  // Tokens are issued via HttpOnly cookies when the backend supports secure sessions.
  // We keep only non-sensitive profile data in localStorage.
  const payload = response?.data || {};
  localStorage.setItem(
    "customer_info",
    JSON.stringify({
      customerId: payload.customerId,
      name: payload.name,
      email: payload.email,
      principalType: payload.principalType,
    }),
  );

  // Transitional fallback: if the backend still returns a body token, store it
  // temporarily in sessionStorage (not localStorage) so the secret is not persisted
  // across browser restarts.
  const token =
    payload?.token ||
    response?.headers?.authorization ||
    response?.headers?.Authorization;
  if (token) {
    const bearer = token.replace(/^Bearer\s+/i, "");
    try {
      sessionStorage.setItem("auth_token", bearer);
    } catch {
      // ignore
    }
  }
};

export const clearCustomerSession = () => {
  setAuthHeader(null);
  localStorage.removeItem("customer_info");
  try {
    sessionStorage.removeItem("auth_token");
  } catch {
    // ignore
  }
};

export const getCustomerInfo = () => {
  try {
    const raw = localStorage.getItem("customer_info");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
