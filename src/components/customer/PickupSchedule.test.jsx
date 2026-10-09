import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PickupSchedule from "./PickupSchedule";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, values) => values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

const order = {
  pickupSlotStart: "2026-10-09T13:00:00Z",
  pickupSlotEnd: "2026-10-09T13:30:00Z",
  pickupExpiresAt: "2026-10-09T14:00:00Z",
  pickupTimezone: "Asia/Singapore",
};

describe("pickup schedule display", () => {
  afterEach(cleanup);

  it("shows the slot and deadline in the store timezone", () => {
    render(<PickupSchedule order={order} />);
    expect(screen.getByText("customer.cart.pickupScheduled 21:00 - 21:30 Asia/Singapore")).toBeInTheDocument();
    expect(screen.getByText("customer.cart.pickupDeadline 22:00")).toBeInTheDocument();
  });

  it("does not invent a schedule for legacy orders", () => {
    const { container } = render(<PickupSchedule order={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    { pickupTimezone: "INVALID" },
    { pickupSlotEnd: undefined },
    { pickupExpiresAt: "2026-10-09T13:30:00Z" },
  ])("surfaces invalid schedule data %j", (changes) => {
    render(<PickupSchedule order={{ ...order, ...changes }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("customer.cart.pickupScheduleInvalid");
  });
});
