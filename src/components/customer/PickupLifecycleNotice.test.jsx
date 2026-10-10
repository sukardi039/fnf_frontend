import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import PickupLifecycleNotice from "./PickupLifecycleNotice";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key, values) => values ? `${key} ${Object.values(values).join(" ")}` : key }),
}));

describe("pickup lifecycle notices", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it("updates overdue display at the due time without waiting for navigation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T04:00:00Z"));
    render(<PickupLifecycleNotice order={{ channel: "MOBILE_ORDER", state: "PAYMENT_SUCCESS",
      paymentStatus: "SUCCESS", pickupExpiresAt: "2026-10-10T04:00:30Z" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(90_000));
    expect(screen.getByRole("alert")).toHaveTextContent("pickup.overdueMinutes 1");
  });
  it("shows the backend payment window and keeps checking after it ends", () => {
    render(<PickupLifecycleNotice order={{ state: "PAYMENT_PENDING", paymentResolutionStatus: "CHECKING",
      paymentResolutionDeadline: "2026-10-09T04:00:00Z" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("pickup.paymentChecking");
    expect(screen.getByRole("alert")).toHaveTextContent("pickup.resolutionDeadline");
  });
  it("shows malformed lifecycle metadata as an error, not a normal order", () => {
    render(<PickupLifecycleNotice order={{ paymentResolutionStatus: "UNRECOGNIZED" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("pickup.invalidResponse");
  });
});
