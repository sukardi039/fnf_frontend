import { request, setCustomerAuthToken } from "./axios_helper";

const API_BASE = "/api";

export const registerCustomer = (data) =>
  request("POST", `${API_BASE}/auth/customers/register`, data, {
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const loginCustomer = (data) =>
  request("POST", `${API_BASE}/auth/customers/login`, data, {
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const storeCustomerSession = (response) => {
  // Tokens are issued via HttpOnly cookies when the backend supports secure sessions.
  // Keep the customer profile separate from staff/system credentials.
  const payload = response?.data || {};
  storeCustomerInfo({
    customerId: payload.customerId,
    name: payload.name,
    email: payload.email,
    mobileNumber: payload.mobileNumber,
    principalType: payload.principalType,
  });

  // Transitional bearer tokens must never replace the system-user session.
  const token =
    payload?.accessToken ||
    payload?.token ||
    response?.headers?.authorization ||
    response?.headers?.Authorization;
  setCustomerAuthToken(token || null);
};

export const updateCustomerProfile = (customerId, data) =>
  request("PUT", `${API_BASE}/customers/${encodeURIComponent(customerId)}`, data, {
    skipAuthRedirect: true,
    authScope: "customer",
    skipBackendErrorDialog: true,
  });

export const storeCustomerInfo = (customer) => {
  localStorage.setItem("customer_info", JSON.stringify(customer));
};

export const clearCustomerSession = () => {
  setCustomerAuthToken(null);
  localStorage.removeItem("customer_info");
};

export const getCustomerInfo = () => {
  try {
    const raw = localStorage.getItem("customer_info");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
