import { describe, expect, it } from "vitest";
import { emptyBusinessHours, validateBusinessHours } from "./store_hours_helper";

describe("weekly business hours validation", () => {
  it("accepts closed days and split shifts", () => {
    const hours = { ...emptyBusinessHours(), MONDAY: [
      { opensAt: "09:00", closesAt: "12:00" }, { opensAt: "14:00", closesAt: "22:00" },
    ] };
    expect(validateBusinessHours(hours)).toBe(hours);
  });
  it.each([null, {}, { ...emptyBusinessHours(), MONDAY: [{ opensAt: "25:00", closesAt: "22:00" }] },
    { ...emptyBusinessHours(), MONDAY: [{ opensAt: "09:00", closesAt: "09:00" }] }])(
    "rejects incomplete or invalid hours %j", (hours) => {
      expect(() => validateBusinessHours(hours)).toThrow("hoursInvalid");
    },
  );
  it("rejects overlaps in a day and across the Sunday/Monday boundary", () => {
    expect(() => validateBusinessHours({ ...emptyBusinessHours(), MONDAY: [
      { opensAt: "09:00", closesAt: "12:00" }, { opensAt: "11:00", closesAt: "15:00" },
    ] })).toThrow("hoursOverlap");
    expect(() => validateBusinessHours({ ...emptyBusinessHours(),
      SUNDAY: [{ opensAt: "20:00", closesAt: "03:00" }],
      MONDAY: [{ opensAt: "02:00", closesAt: "12:00" }],
    })).toThrow("hoursOverlap");
  });
});
