export const RECONCILIATION_OUTCOMES = ["RECORD_UNRESOLVED", "CLOSE_UNPAID", "RESTORE_PAID"];

const nonblank = (value) => typeof value === "string" && Boolean(value.trim());

export const isReconciliationReview = (review) => Boolean(
  review && nonblank(review.reviewId) &&
  RECONCILIATION_OUTCOMES.includes(review.outcome) &&
  nonblank(review.note) && review.note.length <= 500 &&
  nonblank(review.reviewedBy) && nonblank(review.reviewedAt) &&
  Number.isFinite(Date.parse(review.reviewedAt)),
);

export const hasValidReconciliation = (order) => {
  const review = order.reconciliation;
  if (review == null) return true;
  return typeof review.required === "boolean" &&
    (review.reason == null || ["LEGACY_ORDER", "MISSING_PICKUP_SCHEDULE", "PAID_EXPIRED",
      "PAYMENT_UNRESOLVED", "FULFILMENT_REVIEW"].includes(review.reason)) &&
    (!review.required || nonblank(review.reason)) &&
    Array.isArray(review.allowedOutcomes) &&
    new Set(review.allowedOutcomes).size === review.allowedOutcomes.length &&
    review.allowedOutcomes.every((outcome) => RECONCILIATION_OUTCOMES.includes(outcome)) &&
    (review.required || review.allowedOutcomes.length === 0) &&
    (review.latestReview == null || isReconciliationReview(review.latestReview));
};
