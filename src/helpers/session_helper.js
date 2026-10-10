export const currentSessionInterface = () => {
  const path = window.location.pathname;
  if (path === "/pda" || path.startsWith("/pda/")) return "PDA";
  if (path === "/m" || path.startsWith("/m/")) return "MOBILE";
  return "WEB";
};

export const sessionInterfaceFor = (config = {}) =>
  config.authScope === "customer" ? "MOBILE" :
    config.sessionInterface || (currentSessionInterface() === "PDA" ? "PDA" : "WEB");

export const sessionLoginPath = (surface) =>
  surface === "MOBILE" ? "/m/auth" : surface === "PDA" ? "/pda/login" : "/login";

const generations = { WEB: 0, PDA: 0, MOBILE: 0 };
export const sessionGeneration = (surface) => generations[surface];

export const clearSessionCredentials = (surface) => {
  generations[surface] += 1;
  if (surface === "MOBILE") {
    sessionStorage.removeItem("customer_auth_token");
    localStorage.removeItem("customer_info");
  } else if (surface === "PDA") {
    sessionStorage.removeItem("pda_auth_token");
    localStorage.removeItem("pda_auth_token");
    localStorage.removeItem("pda_user_info");
  } else {
    sessionStorage.removeItem("auth_token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
  }
};

const isAuthenticationEndpoint = (url = "") =>
  /^(\/login|\/register|\/auth\/logout|\/api\/auth\/customers\/(login|register)|\/api\/mobile-logins\/(login|verify|logout))$/
    .test(url.split("?")[0]);

export const isBackendSessionExpiry = (error) =>
  ["SESSION_EXPIRED", "SESSION_REVOKED", "INVALID_SESSION"].includes(
    error.response?.data?.errorCode || error.response?.data?.code,
  ) ||
  (error.response?.status === 401 && !isAuthenticationEndpoint(error.config?.url));

export const expireSession = (surface) => {
  clearSessionCredentials(surface);
  const detail = { interface: surface, loginPath: sessionLoginPath(surface), handled: false };
  window.dispatchEvent(new CustomEvent("auth:expired", { detail }));
  if (currentSessionInterface() === surface && !detail.handled) {
    window.location.replace(detail.loginPath);
  }
};
