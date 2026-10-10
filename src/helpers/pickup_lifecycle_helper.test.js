import { describe, expect, it } from "vitest";
import { canContinuePickupPayment, hasValidPickupLifecycle, isPaidPickupOverdue, isPickupBlocked } from "./pickup_lifecycle_helper";

const paid = { channel: "MOBILE_ORDER", state: "PAYMENT_SUCCESS", paymentStatus: "SUCCESS",
  pickupExpiresAt: "2026-10-10T04:00:00Z" };
const deadline = Date.parse(paid.pickupExpiresAt);

describe("pickup lifecycle", () => {
  it("allows the original in-flight redirect, but blocks new payment while checking, held, paid or terminal", () => {
    const pending = { state: "PAYMENT_PENDING", paymentStatus: "PENDING", paymentResolutionStatus: "IN_FLIGHT" };
    expect(canContinuePickupPayment(pending)).toBe(true);
    expect(canContinuePickupPayment({ ...pending, paymentResolutionStatus: "CHECKING" })).toBe(false);
    expect(canContinuePickupPayment({ ...pending, fulfilmentHoldReason: "LATE_PAYMENT" })).toBe(false);
    expect(canContinuePickupPayment({ ...pending, state: "EXPIRED" })).toBe(false);
    expect(canContinuePickupPayment(paid)).toBe(false);
  });
  it("marks paid orders overdue at the due time without blocking late collection", () => {
    expect(isPaidPickupOverdue(paid, deadline - 1)).toBe(false);
    expect(isPaidPickupOverdue(paid, deadline)).toBe(true);
    expect(isPickupBlocked(paid)).toBe(false);
    expect(isPaidPickupOverdue({ ...paid, paymentStatus: "PENDING" }, deadline)).toBe(false);
  });
  it.each(["HANDED_OVER", "EXPIRED", "CANCELLED", "REFUNDED"])("does not relabel %s as active overdue", (state) => {
    expect(isPaidPickupOverdue({ ...paid, state }, deadline)).toBe(false);
  });
  it("prefers authoritative timing metadata to the browser clock", () => {
    expect(isPaidPickupOverdue({ ...paid, pickupTimingStatus: "ON_TIME" }, deadline + 1)).toBe(false);
    expect(isPaidPickupOverdue({ ...paid, pickupTimingStatus: "OVERDUE" }, deadline - 1)).toBe(true);
  });
  it.each([
    { paymentResolutionStatus: "IN_FLIGHT" }, { paymentResolutionStatus: "CHECKING" },
    { fulfilmentHoldReason: "LATE_PAYMENT" }, { fulfilmentHoldReason: "QUALITY_REVIEW" },
    { state: "EXPIRED" },
  ])("blocks unsafe collection %j", (fields) => {
    expect(isPickupBlocked({ ...paid, ...fields })).toBe(true);
  });
  it.each([
    { pickupTimingStatus: "UNKNOWN" }, { paymentResolutionStatus: "UNKNOWN" },
    { fulfilmentHoldReason: "UNKNOWN" }, { paymentResolutionDeadline: "invalid" },
  ])("rejects unknown lifecycle metadata %j", (fields) => {
    expect(hasValidPickupLifecycle(fields)).toBe(false);
  });
});
