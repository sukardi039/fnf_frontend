import { getAuthToken } from "./axios_helper";

export const pickupCommandKey = async (storeId, transactionId, name, payload) => {
  const signature = JSON.stringify({
    session: getAuthToken(), storeId, transactionId, name, payload,
  });
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
  const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const storageKey = `pickup-command:${digest}`;
  let key = sessionStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  return key;
};
