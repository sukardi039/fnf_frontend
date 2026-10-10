const nonblank = (value) => typeof value === "string" && Boolean(value.trim());
const uuid = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validSlot = (slot) => {
  if (!slot || !nonblank(slot.pickupTimezone)) return false;
  const dates = [slot.pickupSlotStart, slot.pickupSlotEnd, slot.pickupExpiresAt];
  if (!dates.every((value) => nonblank(value) && Number.isFinite(Date.parse(value)))) return false;
  const [start, end, expiry] = dates.map(Date.parse);
  if (end - start !== 30 * 60_000 || expiry - start !== 60 * 60_000) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: slot.pickupTimezone }).format(start);
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
};

const keyFor = (customerId) => {
  if (!nonblank(customerId)) throw new Error("customer.cart.recoveryIdentityMissing");
  return `customer-checkout:${customerId}`;
};

export const readCheckoutAttempt = (customerId) => {
  const raw = sessionStorage.getItem(keyFor(customerId));
  if (!raw) return null;
  const attempt = JSON.parse(raw);
  if (!attempt || !nonblank(attempt.storeId) ||
      !["PAY_AT_COUNTER", "E_PAYMENT"].includes(attempt.paymentMode) ||
      !Array.isArray(attempt.items) || !attempt.items.length ||
      !attempt.items.every((item) => item && nonblank(item.skuId) &&
        (item.productName === undefined || typeof item.productName === "string") &&
        (item.uom === undefined || typeof item.uom === "string") &&
        ["number", "string"].includes(typeof item.quantity) &&
        Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0) ||
      !Array.isArray(attempt.itemKeys) || attempt.itemKeys.length !== attempt.items.length ||
      ![attempt.createKey, attempt.checkoutKey, ...attempt.itemKeys].every(uuid) ||
      !Number.isInteger(attempt.added) || attempt.added < 0 || attempt.added > attempt.items.length ||
      (attempt.cartId !== null && !nonblank(attempt.cartId)) ||
      (attempt.quoteId !== null && !nonblank(attempt.quoteId)) ||
      (attempt.added > 0 && (!attempt.cartId || !attempt.quoteId)) ||
      (attempt.added === 0 && attempt.quoteId !== null) ||
      !validSlot(attempt.pickupSlot)) {
    throw new Error("customer.cart.recoveryInvalid");
  }
  return attempt;
};

export const saveCheckoutAttempt = (customerId, attempt) =>
  sessionStorage.setItem(keyFor(customerId), JSON.stringify(attempt));

export const clearCheckoutAttempt = (customerId) =>
  sessionStorage.removeItem(keyFor(customerId));
