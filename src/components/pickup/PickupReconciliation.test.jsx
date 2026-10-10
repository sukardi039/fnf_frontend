import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PickupReconciliation from "./PickupReconciliation";
import { pickupOrder } from "./pickupTestData";
import { reconcilePickupOrder } from "../../helpers/pickup_helper";
import { pickupCommandKey } from "../../helpers/pickup_command_helper";

vi.mock("../../helpers/pickup_helper", () => ({ reconcilePickupOrder: vi.fn() }));
vi.mock("../../helpers/pickup_command_helper", () => ({ pickupCommandKey: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key, values) => values ? `${key} ${Object.values(values).join(" ")}` : key }),
}));

const disabledActions = Object.fromEntries(Object.keys(pickupOrder.actions).map((key) => [key, false]));
const order = {
  ...pickupOrder, state: "PAYMENT_PENDING", paymentStatus: "PENDING",
  pickupSlotStart: null, pickupSlotEnd: null, pickupExpiresAt: null, pickupTimezone: null,
  actions: disabledActions,
  reconciliation: {
    required: true, reason: "MISSING_PICKUP_SCHEDULE",
    allowedOutcomes: ["RECORD_UNRESOLVED", "CLOSE_UNPAID"], latestReview: null,
  },
};
const reviewResult = (outcome, note) => ({
  ...order,
  ...(outcome === "CLOSE_UNPAID" ? { state: "CANCELLED", paymentResolutionStatus: "NONE" } : {}),
  reconciliation: {
    ...order.reconciliation, required: outcome === "RECORD_UNRESOLVED",
    allowedOutcomes: outcome === "RECORD_UNRESOLVED" ? ["RECORD_UNRESOLVED"] : [],
    latestReview: {
      reviewId: "REVIEW-1", outcome, note, reviewedBy: "STAFF-1", reviewedAt: "2026-10-10T06:00:00Z",
    },
  },
});

async function choose(user, outcome, note = "Checked provider reference REF-1") {
  await user.click(screen.getByRole("combobox", { name: "pickup.reviewOutcome" }));
  await user.click(screen.getByRole("option", { name: `pickup.reconciliationOutcome.${outcome}` }));
  await user.type(screen.getByLabelText(/pickup.reviewNote/), note);
}

describe("audited pickup reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pickupCommandKey.mockResolvedValue("REVIEW-KEY");
  });
  afterEach(cleanup);

  it("does not infer review permissions when the backend has no capabilities", () => {
    render(<PickupReconciliation order={{ ...order, reconciliation: undefined }}
      onChanged={vi.fn()} onBusyChange={vi.fn()} />);
    expect(screen.getByText("pickup.reconciliationUnavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.saveReview" })).not.toBeInTheDocument();
    expect(reconcilePickupOrder).not.toHaveBeenCalled();
  });

  it("records a note on the original scoped order only after selecting a permitted outcome", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const busy = vi.fn();
    reconcilePickupOrder.mockResolvedValue({
      data: reviewResult("RECORD_UNRESOLVED", "Checked provider reference REF-1"),
    });
    render(<PickupReconciliation order={order} onChanged={changed} onBusyChange={busy} />);
    expect(screen.getByRole("button", { name: "pickup.saveReview" })).toBeDisabled();
    await choose(user, "RECORD_UNRESOLVED");
    await user.click(screen.getByRole("button", { name: "pickup.saveReview" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(reconcilePickupOrder).toHaveBeenCalledWith("TX-1", "STORE-1",
      { outcome: "RECORD_UNRESOLVED", note: "Checked provider reference REF-1" }, "REVIEW-KEY");
    expect(busy).toHaveBeenCalledWith(true);
    expect(busy).toHaveBeenLastCalledWith(false);
  });

  it("requires explicit acknowledgement to close and validates persisted closure/audit", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    reconcilePickupOrder.mockResolvedValue({
      data: reviewResult("CLOSE_UNPAID", "Checked provider reference REF-1"),
    });
    render(<PickupReconciliation order={order} onChanged={changed} onBusyChange={vi.fn()} />);
    await choose(user, "CLOSE_UNPAID");
    expect(screen.getByRole("button", { name: "pickup.saveReview" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "pickup.confirmCloseUnpaid" }));
    await user.click(screen.getByRole("button", { name: "pickup.saveReview" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });

  it("shows persisted actor/time/reference/note even after a closed order is reopened", () => {
    render(<PickupReconciliation order={reviewResult("CLOSE_UNPAID", "Checked provider reference REF-1")}
      onChanged={vi.fn()} onBusyChange={vi.fn()} />);
    expect(screen.getByText("Checked provider reference REF-1")).toBeInTheDocument();
    expect(screen.getByText(/pickup.reconciliationRecorded .*STAFF-1/)).toBeInTheDocument();
    expect(screen.getByText("pickup.reviewReference REVIEW-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pickup.saveReview" })).not.toBeInTheDocument();
  });

  it.each([
    [403, "Not authorized"], [409, "Payment outcome unknown"], [404, "pickup.reconciliationUnavailable"],
  ])("shows %s failure and blocks retries until refresh without claiming closure", async (status, message) => {
    const user = userEvent.setup();
    const changed = vi.fn();
    reconcilePickupOrder.mockRejectedValue({ response: { status, data: { message } } });
    render(<PickupReconciliation order={order} onChanged={changed} onBusyChange={vi.fn()} />);
    await choose(user, "RECORD_UNRESOLVED");
    await user.click(screen.getByRole("button", { name: "pickup.saveReview" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pickup.saveReview" })).toBeDisabled();
    expect(changed).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "pickup.refresh" }));
    expect(changed).toHaveBeenCalledOnce();
  });

  it("rejects a success-shaped closure that still has confirmed payment", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    reconcilePickupOrder.mockResolvedValue({ data: {
      ...reviewResult("CLOSE_UNPAID", "Checked provider reference REF-1"), paymentStatus: "SUCCESS",
    } });
    render(<PickupReconciliation order={order} onChanged={changed} onBusyChange={vi.fn()} />);
    await choose(user, "CLOSE_UNPAID");
    await user.click(screen.getByRole("checkbox", { name: "pickup.confirmCloseUnpaid" }));
    await user.click(screen.getByRole("button", { name: "pickup.saveReview" }));
    expect(await screen.findByText("pickup.reconciliationInvalidResult")).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it("restores a paid order only with an authoritative active scheduled response", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const paid = { ...order, state: "EXPIRED", paymentStatus: "SUCCESS",
      reconciliation: { ...order.reconciliation, reason: "PAID_EXPIRED", allowedOutcomes: ["RESTORE_PAID"] } };
    reconcilePickupOrder.mockResolvedValue({ data: {
      ...pickupOrder, reconciliation: {
        ...reviewResult("CLOSE_UNPAID", "Checked provider reference REF-1").reconciliation,
        latestReview: { ...reviewResult("CLOSE_UNPAID", "Checked provider reference REF-1")
          .reconciliation.latestReview, outcome: "RESTORE_PAID" },
      },
    } });
    render(<PickupReconciliation order={paid} onChanged={changed} onBusyChange={vi.fn()} />);
    await choose(user, "RESTORE_PAID");
    await user.click(screen.getByRole("checkbox", { name: "pickup.confirmRestorePaid" }));
    await user.click(screen.getByRole("button", { name: "pickup.saveReview" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });

  it.each([
    { transactionId: "OTHER" },
    { reconciliation: null },
    { pickupSlotEnd: "2026-10-09T10:45:00Z" },
  ])("rejects a mismatched or incomplete restoration result %j", async (invalid) => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const paid = { ...order, state: "EXPIRED", paymentStatus: "SUCCESS",
      reconciliation: { ...order.reconciliation, reason: "PAID_EXPIRED", allowedOutcomes: ["RESTORE_PAID"] } };
    const result = reviewResult("CLOSE_UNPAID", "Checked provider reference REF-1").reconciliation;
    reconcilePickupOrder.mockResolvedValue({ data: {
      ...pickupOrder, reconciliation: { ...result, latestReview: { ...result.latestReview, outcome: "RESTORE_PAID" } },
      ...invalid,
    } });
    render(<PickupReconciliation order={paid} onChanged={changed} onBusyChange={vi.fn()} />);
    await choose(user, "RESTORE_PAID");
    await user.click(screen.getByRole("checkbox", { name: "pickup.confirmRestorePaid" }));
    await user.click(screen.getByRole("button", { name: "pickup.saveReview" }));
    await screen.findByText(invalid.transactionId ? "pickup.invalidResponse" : "pickup.reconciliationInvalidResult");
    expect(changed).not.toHaveBeenCalled();
  });

  it("does not submit blank or overlength notes or duplicate in-flight requests", async () => {
    const user = userEvent.setup();
    let resolve;
    reconcilePickupOrder.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<PickupReconciliation order={order} onChanged={vi.fn()} onBusyChange={vi.fn()} />);
    await choose(user, "RECORD_UNRESOLVED", "   ");
    expect(screen.getByRole("button", { name: "pickup.saveReview" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/pickup.reviewNote/), { target: { value: "a".repeat(501) } });
    expect(screen.getByRole("button", { name: "pickup.saveReview" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/pickup.reviewNote/), { target: { value: "Checked" } });
    const form = screen.getByRole("button", { name: "pickup.saveReview" }).closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(reconcilePickupOrder).toHaveBeenCalledOnce());
    resolve({ data: reviewResult("RECORD_UNRESOLVED", "Checked") });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
