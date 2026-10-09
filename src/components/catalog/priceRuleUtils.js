export const getPriceRuleStatus = (rule, now = Date.now()) => {
  if (rule?.status === "EXPIRED") return "EXPIRED";
  if (rule?.status !== "ACTIVE" || !rule.endAt) return rule?.status;

  const endAt = Date.parse(rule.endAt);
  return Number.isFinite(endAt) && endAt < now ? "EXPIRED" : "ACTIVE";
};

export const canPublishPriceRule = (rule, now = Date.now()) => {
  if (rule?.status !== "DRAFT" || !rule.endAt) return false;

  const endAt = Date.parse(rule.endAt);
  return Number.isFinite(endAt) && now <= endAt;
};
