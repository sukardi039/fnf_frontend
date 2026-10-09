import { describe, expect, it } from "vitest";
import {
  canPublishPriceRule,
  getPriceRuleStatus,
} from "./priceRuleUtils";

describe("price-rule lifecycle", () => {
  const now = Date.parse("2026-10-05T10:00:00Z");

  it("allows publishing a draft only through its end time", () => {
    expect(
      canPublishPriceRule(
        { status: "DRAFT", endAt: "2026-10-05T10:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      canPublishPriceRule(
        { status: "DRAFT", endAt: "2026-10-05T09:59:59Z" },
        now,
      ),
    ).toBe(false);
    expect(
      canPublishPriceRule(
        { status: "ACTIVE", endAt: "2026-10-06T00:00:00Z" },
        now,
      ),
    ).toBe(false);
  });

  it("shows expired after an ACTIVE rule's end time", () => {
    expect(
      getPriceRuleStatus(
        { status: "ACTIVE", endAt: "2026-10-05T09:59:00Z" },
        now,
      ),
    ).toBe("EXPIRED");
    expect(
      getPriceRuleStatus(
        { status: "ACTIVE", endAt: "2026-10-05T10:01:00Z" },
        now,
      ),
    ).toBe("ACTIVE");
    expect(getPriceRuleStatus({ status: "EXPIRED" }, now)).toBe("EXPIRED");
  });
});
