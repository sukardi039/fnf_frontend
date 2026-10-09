import { describe, expect, it } from "vitest";
import { getPromotionDisplayItems } from "./promotionUtils";

describe("getPromotionDisplayItems", () => {
  const now = new Date(2026, 9, 5, 12);

  it("classifies an already-started promotion that remains active today as today's", () => {
    const [promotion] = getPromotionDisplayItems(
      [
        {
          ruleId: "OCT-4-8",
          startAt: new Date(2026, 9, 4, 0).toISOString(),
          endAt: new Date(2026, 9, 8, 23, 59).toISOString(),
        },
      ],
      now,
    );

    expect(promotion).toMatchObject({ ruleId: "OCT-4-8", isToday: true });
  });

  it("keeps rules starting later in the window as upcoming", () => {
    const [promotion] = getPromotionDisplayItems(
      [
        {
          ruleId: "OCT-6-8",
          startAt: new Date(2026, 9, 6, 0).toISOString(),
          endAt: new Date(2026, 9, 8, 23, 59).toISOString(),
        },
      ],
      now,
    );

    expect(promotion).toMatchObject({ ruleId: "OCT-6-8", isToday: false });
  });

  it("excludes expired promotions and rules beyond the upcoming window", () => {
    const displayed = getPromotionDisplayItems(
      [
        {
          ruleId: "EXPIRED",
          startAt: new Date(2026, 9, 1).toISOString(),
          endAt: new Date(2026, 9, 4, 23, 59).toISOString(),
        },
        {
          ruleId: "TOO-FAR",
          startAt: new Date(2026, 9, 8, 0).toISOString(),
          endAt: new Date(2026, 9, 9, 23, 59).toISOString(),
        },
      ],
      now,
    );

    expect(displayed).toEqual([]);
  });
});
