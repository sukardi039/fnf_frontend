import { describe, expect, it } from "vitest";
import { formatPickupSlot, getPickupSlots } from "./pickup_time_helper";
import { emptyBusinessHours, WEEKDAYS } from "./store_hours_helper";

const hours = Object.fromEntries(WEEKDAYS.map((day) => [day, [{ opensAt: "00:00", closesAt: "22:00" }]]));

describe("same-day pickup slots in the store timezone", () => {
  it("rounds up to the next half hour at least 90 minutes ahead", () => {
    const slots = getPickupSlots(new Date("2026-10-09T07:48:55Z"), "Asia/Singapore", hours);
    expect(formatPickupSlot(slots[0])).toBe("17:30 - 18:00");
    expect(slots[0].pickupExpiresAt).toBe("2026-10-09T10:30:00.000Z");
    expect(slots.at(-1)).toEqual({
      pickupSlotStart: "2026-10-09T13:00:00.000Z",
      pickupSlotEnd: "2026-10-09T13:30:00.000Z",
      pickupExpiresAt: "2026-10-09T14:00:00.000Z",
      pickupTimezone: "Asia/Singapore",
    });
    expect(slots).toHaveLength(8);
    for (const [index, slot] of slots.entries()) {
      const start = Date.parse(slot.pickupSlotStart);
      expect(start - Date.parse("2026-10-09T07:48:55Z")).toBeGreaterThanOrEqual(90 * 60 * 1000);
      expect(Date.parse(slot.pickupSlotEnd) - start).toBe(30 * 60 * 1000);
      expect(Date.parse(slot.pickupExpiresAt) - start).toBe(60 * 60 * 1000);
      if (index > 0) expect(start - Date.parse(slots[index - 1].pickupSlotStart)).toBe(30 * 60 * 1000);
    }
  });

  it("includes exactly 90 minutes but excludes even one millisecond less", () => {
    expect(getPickupSlots(new Date("2026-10-09T11:30:00Z"), "Asia/Singapore", hours)).toHaveLength(1);
    expect(getPickupSlots(new Date("2026-10-09T11:30:00.001Z"), "Asia/Singapore", hours)).toEqual([]);
  });

  it("uses the store date rather than the browser or UTC date", () => {
    const slots = getPickupSlots(new Date("2026-10-09T18:10:00Z"), "Asia/Singapore", hours);
    expect(slots[0].pickupSlotStart).toBe("2026-10-09T20:00:00.000Z");
    expect(formatPickupSlot(slots[0])).toBe("04:00 - 04:30");
    expect(slots.at(-1).pickupSlotStart).toBe("2026-10-10T13:00:00.000Z");
  });

  it("rejects missing or invalid timezone instead of using the browser timezone", () => {
    expect(() => getPickupSlots(new Date(), "", hours)).toThrow();
    expect(() => getPickupSlots(new Date(), "INVALID", hours)).toThrow();
  });

  it("keeps the full hour within each split shift and does not bridge a break", () => {
    const businessHours = { ...emptyBusinessHours(), FRIDAY: [
      { opensAt: "09:15", closesAt: "12:15" }, { opensAt: "14:00", closesAt: "20:00" },
    ] };
    const slots = getPickupSlots(new Date("2026-10-09T00:00:00Z"), "Asia/Singapore", businessHours);
    const labels = slots.map(formatPickupSlot);
    expect(labels[0]).toBe("09:30 - 10:00");
    expect(labels).toContain("11:00 - 11:30");
    expect(labels).not.toContain("11:30 - 12:00");
    expect(labels).not.toContain("13:30 - 14:00");
    expect(labels.at(-1)).toBe("19:00 - 19:30");
    expect(slots.at(-1).pickupExpiresAt).toBe("2026-10-09T12:00:00.000Z");
  });

  it("offers nothing on a closed day", () => {
    expect(getPickupSlots(new Date("2026-10-09T00:00:00Z"), "Asia/Singapore",
      emptyBusinessHours())).toEqual([]);
  });

  it("uses yesterday's overnight interval for today's early pickup", () => {
    const businessHours = { ...emptyBusinessHours(), THURSDAY: [{ opensAt: "20:00", closesAt: "03:00" }] };
    const slots = getPickupSlots(new Date("2026-10-08T16:00:00Z"), "Asia/Singapore", businessHours);
    expect(slots.map(formatPickupSlot)).toEqual(["01:30 - 02:00", "02:00 - 02:30"]);
    expect(slots.at(-1).pickupExpiresAt).toBe("2026-10-08T19:00:00.000Z");
  });

  it("allows today's late slot to finish after midnight while the store remains open", () => {
    const businessHours = { ...emptyBusinessHours(), FRIDAY: [{ opensAt: "20:00", closesAt: "03:00" }] };
    const slots = getPickupSlots(new Date("2026-10-09T12:00:00Z"), "Asia/Singapore", businessHours);
    expect(formatPickupSlot(slots.at(-1))).toBe("23:30 - 00:00 (2026-10-10)");
    expect(slots.at(-1).pickupExpiresAt).toBe("2026-10-09T16:30:00.000Z");
    expect(slots.every((slot) => Date.parse(slot.pickupSlotStart) < Date.parse("2026-10-09T16:00:00Z"))).toBe(true);
  });

  it("handles a store timezone with a quarter-hour offset", () => {
    const businessHours = { ...emptyBusinessHours(), FRIDAY: [{ opensAt: "09:00", closesAt: "18:00" }] };
    const slots = getPickupSlots(new Date("2026-10-09T03:15:00Z"), "Asia/Kathmandu", businessHours);
    expect(formatPickupSlot(slots[0])).toBe("10:30 - 11:00");
  });

  it("keeps durations correct across the spring daylight-saving transition", () => {
    const businessHours = { ...emptyBusinessHours(), SATURDAY: [{ opensAt: "22:00", closesAt: "04:00" }] };
    const slots = getPickupSlots(new Date("2026-03-08T05:00:00Z"), "America/New_York", businessHours);
    expect(slots[0].pickupSlotStart).toBe("2026-03-08T06:30:00.000Z");
    expect(slots[0].pickupSlotEnd).toBe("2026-03-08T07:00:00.000Z");
    expect(slots.every((slot) => Date.parse(slot.pickupExpiresAt) <= Date.parse("2026-03-08T08:00:00Z"))).toBe(true);
    expect(slots.map(formatPickupSlot)).not.toContain("02:00 - 02:30");
  });

  it("distinguishes repeated fall-back times by their checkout instants", () => {
    const businessHours = { ...emptyBusinessHours(), SATURDAY: [{ opensAt: "22:00", closesAt: "04:00" }] };
    const slots = getPickupSlots(new Date("2026-11-01T04:00:00Z"), "America/New_York", businessHours);
    expect(slots.some((slot) => slot.pickupSlotStart === "2026-11-01T05:30:00.000Z")).toBe(true);
    expect(slots.some((slot) => slot.pickupSlotStart === "2026-11-01T06:30:00.000Z")).toBe(true);
    expect(slots.every((slot) => Date.parse(slot.pickupExpiresAt) <= Date.parse("2026-11-01T09:00:00Z"))).toBe(true);
  });
});
