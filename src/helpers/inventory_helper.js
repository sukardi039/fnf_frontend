import { request } from "./axios_helper";

const API_BASE = "/api";

/**
 * Fetch authoritative inventory snapshots for a store.
 *
 * @param {Object} params
 * @param {string} params.storeId
 * @param {string} [params.skuId]
 * @param {boolean} [params.includeLots=false]
 * @param {number} [params.page=0]
 * @param {number} [params.pageSize=100]
 */
export const listInventorySnapshots = ({
  storeId,
  skuId,
  includeLots = false,
  page = 0,
  pageSize = 100,
}) => {
  const query = new URLSearchParams();
  query.set("storeId", storeId);
  if (skuId) query.set("skuId", skuId);
  if (includeLots) query.set("includeLots", String(includeLots));
  query.set("page", String(page));
  query.set("pageSize", String(pageSize));

  return request("GET", `${API_BASE}/inventory/snapshots?${query.toString()}`);
};
