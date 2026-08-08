import { request } from "../../helpers/axios_helper";

export const fetchActiveProducts = () =>
  request("GET", "/api/products?active=true", null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
