export const getPromotionDisplayItems = (
  rules,
  now = new Date(),
  daysAhead = 2,
) => {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const windowEnd = new Date(todayEnd);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);

  return rules
    .map((rule) => {
      const start = rule.startAt ? new Date(rule.startAt) : null;
      const end = rule.endAt ? new Date(rule.endAt) : null;
      if (
        !start ||
        !end ||
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < todayStart ||
        start > windowEnd
      ) {
        return null;
      }

      return {
        ...rule,
        isToday: start <= todayEnd && end >= todayStart,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
};
