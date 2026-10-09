import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
  useTheme,
} from "@mui/material";
import { LocalOffer as LocalOfferIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { listPriceRules } from "../catalog/productApi";
import LoadingState from "../common/LoadingState";
import { getPromotionDisplayItems } from "./promotionUtils";

const formatDate = (value, locale = "default") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
};

const DiscountCard = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await listPriceRules({ status: "ACTIVE" });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (!active) return;
        setRules(items);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message || t("priceRule.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t]);

  const displayItems = useMemo(() => {
    return getPromotionDisplayItems(rules).map((rule) => ({
      ...rule,
      displayDate: formatDate(rule.startAt, i18n.language),
    }));
  }, [rules, i18n.language]);

  const todayCount = displayItems.filter((item) => item.isToday).length;

  if (loading) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ p: 3 }}>
          <LoadingState message={t("dashboard.discount.loading")} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": {
          boxShadow: theme.shadows[4],
          transform: "translateY(-2px)",
          transition: "all 0.3s ease",
        },
      }}
    >
      <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: "success.main",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.9,
            }}
          >
            <LocalOfferIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t("dashboard.discount.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.discount.subtitle")}
            </Typography>
          </Box>
        </Box>

        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : displayItems.length === 0 ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.discount.empty")}
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Chip
                size="small"
                label={t("dashboard.discount.todayCount", { count: todayCount })}
                color="success"
                sx={{ fontWeight: 600, mr: 1 }}
              />
              <Chip
                size="small"
                label={t("dashboard.discount.upcomingCount", {
                  count: displayItems.length - todayCount,
                })}
                color="warning"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Box sx={{ flex: 1, overflow: "auto" }}>
              {displayItems.map((item, index) => (
                <React.Fragment key={item.ruleId || index}>
                  {index > 0 && <Divider sx={{ my: 1.5 }} />}
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: item.isToday
                        ? "success.light"
                        : "warning.light",
                      color: item.isToday
                        ? "success.contrastText"
                        : "warning.contrastText",
                      borderLeft: 4,
                      borderColor: item.isToday ? "success.main" : "warning.main",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{
                          color: item.isToday
                            ? "success.contrastText"
                            : "warning.contrastText",
                        }}
                      >
                        {item.ruleName || item.skuId}
                      </Typography>
                      <Chip
                        size="small"
                        label={
                          item.isToday
                            ? t("dashboard.discount.today")
                            : t("dashboard.discount.upcoming")
                        }
                        color={item.isToday ? "success" : "warning"}
                        sx={{
                          fontWeight: 600,
                          color: item.isToday
                            ? "success.contrastText"
                            : "warning.contrastText",
                        }}
                      />
                    </Box>
                    {item.slogan && (
                      <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                        {item.slogan}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mt: 1,
                      }}
                    >
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>
                        {item.discountType === "PERCENT"
                          ? `${item.discountValue}%`
                          : `${item.currency || ""} ${item.discountValue}`}
                        {" · "}
                        {item.productName || item.skuId}
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {item.displayDate}
                      </Typography>
                    </Box>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DiscountCard;
