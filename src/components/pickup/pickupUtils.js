export function isPickupSummary(order, storeId) {
  return Boolean(
    order && order.storeId === storeId && order.channel === "MOBILE_ORDER" &&
    ["E_PAYMENT", "PAY_AT_COUNTER"].includes(order.paymentMode) &&
    typeof order.transactionId === "string" && order.transactionId.trim() &&
    typeof order.state === "string" && typeof order.paymentStatus === "string" &&
    ["NOT_STARTED", "PREPARING", "READY"].includes(order.preparationStatus) &&
    typeof order.currency === "string" && /^[A-Z]{3}$/.test(order.currency) &&
    order.amount !== null && order.amount !== "" &&
    Number.isFinite(Number(order.amount)) && Number(order.amount) >= 0 &&
    Number.isFinite(Date.parse(order.createdAt)) &&
    (order.paymentMode !== "PAY_AT_COUNTER" || (
      order.preparationPolicy === "ON_ARRIVAL" &&
      ["EXPECTED", "ARRIVED"].includes(order.arrivalStatus)
    )),
  );
}

export function validatePickupOrder(order, storeId, transactionId) {
  if (
    !isPickupSummary(order, storeId) || order.transactionId !== transactionId ||
    !Array.isArray(order.items) ||
    order.items.length === 0 || !order.actions ||
    new Set(order.items.map((line) => line?.saleLineId)).size !== order.items.length ||
    !["canAllocateLots", "canStartPreparation", "canMarkReady", "canHandover"]
      .every((key) => typeof order.actions[key] === "boolean") ||
    !order.items.every((line) =>
      line &&
      typeof line.saleLineId === "string" && typeof line.skuId === "string" &&
      typeof line.productName === "string" && typeof line.uom === "string" &&
      Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0 &&
      typeof line.lotTracked === "boolean" &&
      Array.isArray(line.allocations) && Array.isArray(line.availableLots) &&
      line.allocations.every((entry) =>
        entry &&
        typeof entry.lotId === "string" && entry.uom === line.uom &&
        Number.isFinite(Number(entry.quantity)) && Number(entry.quantity) > 0,
      ) &&
      line.availableLots.every((lot) =>
        lot &&
        typeof lot.lotId === "string" && lot.uom === line.uom &&
        Number.isFinite(Number(lot.availableQuantity)) && Number(lot.availableQuantity) >= 0,
      ),
    )
  ) {
    throw new Error("pickup.invalidResponse");
  }
  const hasMutation = Object.values(order.actions).some((value) => value === true);
  const payAtCollection = order.paymentMode === "PAY_AT_COUNTER";
  const cashPending = payAtCollection && order.state === "CASH_PENDING_CONFIRMATION" &&
    order.paymentStatus === "PENDING" && order.preparationStatus === "NOT_STARTED";
  const preparationAction = ["canAllocateLots", "canStartPreparation", "canMarkReady", "canHandover"]
    .some((key) => order.actions[key]);
  if (
    (hasMutation && !cashPending && (order.paymentStatus !== "SUCCESS" ||
      !["PAYMENT_SUCCESS", "READY_FOR_HANDOVER"].includes(order.state))) ||
    (payAtCollection && (
      order.preparationPolicy !== "ON_ARRIVAL" ||
      !["EXPECTED", "ARRIVED"].includes(order.arrivalStatus) ||
      typeof order.actions.canRecordArrival !== "boolean" ||
      typeof order.actions.canConfirmCash !== "boolean" ||
      (preparationAction && (order.arrivalStatus !== "ARRIVED" || order.paymentStatus !== "SUCCESS"))
    )) ||
    (order.actions.canRecordArrival && (!cashPending || order.arrivalStatus !== "EXPECTED")) ||
    (order.actions.canConfirmCash && (!cashPending || order.arrivalStatus !== "ARRIVED")) ||
    (cashPending && preparationAction) ||
    (order.actions.canHandover && order.preparationStatus !== "READY") ||
    (order.actions.canStartPreparation && order.preparationStatus !== "NOT_STARTED") ||
    (order.actions.canMarkReady && order.preparationStatus !== "PREPARING") ||
    (order.actions.canAllocateLots && order.preparationStatus === "READY")
  ) {
    throw new Error("pickup.invalidResponse");
  }
  return order;
}

export function buildPickupAllocations(items, drafts) {
  const allocations = [];
  const lotTotals = new Map();
  for (const line of items.filter((item) => item.lotTracked)) {
    const rows = drafts[line.saleLineId] || [];
    if (rows.length === 0) throw new Error("pickup.allocationRequired");
    let total = 0;
    const usedLots = new Set();
    for (const row of rows) {
      const lot = line.availableLots.find((entry) => entry.lotId === row.lotId);
      const quantity = Number(row.quantity);
      if (!lot || lot.uom !== line.uom || !Number.isFinite(quantity) ||
          quantity <= 0 || usedLots.has(row.lotId)) {
        throw new Error("pickup.invalidAllocation");
      }
      usedLots.add(row.lotId);
      total += quantity;
      const allocated = (lotTotals.get(row.lotId) || 0) + quantity;
      if (!Number.isFinite(Number(lot.availableQuantity)) ||
          allocated - Number(lot.availableQuantity) > 0.000001) {
        throw new Error("pickup.insufficientLot");
      }
      lotTotals.set(row.lotId, allocated);
      allocations.push({
        saleLineId: line.saleLineId, lotId: row.lotId, quantity, uom: line.uom,
      });
    }
    if (Math.abs(total - Number(line.quantity)) > 0.000001) {
      throw new Error("pickup.quantityMismatch");
    }
  }
  if (allocations.length === 0) throw new Error("pickup.allocationRequired");
  return allocations;
}

export const pickupErrorMessage = (error, t) =>
  error?.response?.data?.message ||
  (error?.message?.startsWith("pickup.") ? t(error.message) : error?.message) ||
  t("pickup.requestFailed");
