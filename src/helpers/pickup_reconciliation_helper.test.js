import { describe, expect, it } from "vitest";
import { hasValidReconciliation } from "./pickup_reconciliation_helper";

describe("reconciliation metadata", () => {
  it("accepts old contracts without capabilities and valid audited capability metadata", () => {
    expect(hasValidReconciliation({})).toBe(true);
    expect(hasValidReconciliation({ reconciliation: {
      required: true, reason: "MISSING_PICKUP_SCHEDULE",
      allowedOutcomes: ["RECORD_UNRESOLVED"], latestReview: {
        reviewId: "REVIEW-1", outcome: "RECORD_UNRESOLVED", note: "Evidence REF-1",
        reviewedAt: "2026-10-10T06:00:00Z", reviewedBy: "STAFF-1",
      },
    } })).toBe(true);
  });
  it.each([
    { allowedOutcomes: ["DELETE"] }, { required: "true" }, { reason: null },
    { allowedOutcomes: ["CLOSE_UNPAID", "CLOSE_UNPAID"] },
    { required: false, allowedOutcomes: ["CLOSE_UNPAID"] },
    { latestReview: { outcome: "CLOSE_UNPAID", note: "checked" } },
  ])("rejects malformed or unaudited capabilities %j", (fields) => {
    expect(hasValidReconciliation({ reconciliation: {
      required: true, reason: "LEGACY_ORDER", allowedOutcomes: ["RECORD_UNRESOLVED"], ...fields,
    } })).toBe(false);
  });
});
