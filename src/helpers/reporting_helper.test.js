import { describe, expect, it } from "vitest";
import { formatReportMoney } from "./reporting_helper";

describe("formatReportMoney", () => {
  it("formats numeric daily-summary values", () => {
    expect(formatReportMoney(4820.5)).toBe("4820.50");
  });

  it("formats currency amount objects and numeric strings", () => {
    expect(formatReportMoney({ amount: 4512.3, currency: "MYR" })).toBe(
      "MYR 4512.30",
    );
    expect(formatReportMoney("186.7", "MYR")).toBe("MYR 186.70");
  });

  it("preserves zero and marks missing or invalid values", () => {
    expect(formatReportMoney(0)).toBe("0.00");
    expect(formatReportMoney(null)).toBe("—");
    expect(formatReportMoney("not a number")).toBe("—");
  });
});
