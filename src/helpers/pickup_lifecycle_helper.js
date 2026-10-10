const terminal = new Set(["HANDED_OVER", "CANCELLED", "REFUNDED", "EXPIRED"]);

export const isPaymentResolving = (order) =>
  ["IN_FLIGHT", "CHECKING"].includes(order.paymentResolutionStatus);

export const isPickupBlocked = (order) =>
  !hasValidPickupLifecycle(order) || Boolean(order.fulfilmentHoldReason) || isPaymentResolving(order) ||
  (order.state === "EXPIRED" && order.paymentStatus === "SUCCESS");

export const canContinuePickupPayment = (order) =>
  hasValidPickupLifecycle(order) && !terminal.has(order.state) &&
  !order.fulfilmentHoldReason && order.paymentResolutionStatus !== "CHECKING" &&
  order.paymentStatus !== "SUCCESS";

export const isPaidPickupOverdue = (order, now = Date.now()) =>
  order.channel === "MOBILE_ORDER" && order.paymentStatus === "SUCCESS" &&
  !terminal.has(order.state) &&
  (order.pickupTimingStatus === "OVERDUE" ||
    (order.pickupTimingStatus == null && Number.isFinite(Date.parse(order.pickupExpiresAt)) &&
      Date.parse(order.pickupExpiresAt) <= now));

export const hasValidPickupLifecycle = (order) =>
  (order.pickupTimingStatus == null || ["ON_TIME", "OVERDUE"].includes(order.pickupTimingStatus)) &&
  (order.paymentResolutionStatus == null ||
    ["NONE", "IN_FLIGHT", "CHECKING"].includes(order.paymentResolutionStatus)) &&
  (order.fulfilmentHoldReason == null ||
    ["LATE_PAYMENT", "QUALITY_REVIEW"].includes(order.fulfilmentHoldReason)) &&
  (order.paymentResolutionDeadline == null ||
    (typeof order.paymentResolutionDeadline === "string" &&
      Number.isFinite(Date.parse(order.paymentResolutionDeadline))));
