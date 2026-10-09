import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import { PointOfSale as PointOfSaleIcon } from "@mui/icons-material";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  formatReportMoney,
  getDailySummary,
} from "../../helpers/reporting_helper";
import LoadingState from "../common/LoadingState";

const SalesCard = ({ date, storeId }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    if (storeId) {
      const load = async () => {
        setLoading(true);
        setError("");
        try {
          const response = await getDailySummary({ date, storeId });
          if (!active) return;
          setSummary(response.data ?? null);
        } catch (requestError) {
          if (!active) return;
          setError(
            requestError?.response?.data?.message ||
              t("dashboard.sales.loadFailed"),
          );
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
    }

    return () => {
      active = false;
    };
  }, [date, storeId, t]);

  const metrics = summary
    ? [
        {
          label: t("dailySummary.grossSales"),
          value: formatReportMoney(summary.grossSales, summary.currency),
        },
        {
          label: t("dailySummary.netSales"),
          value: formatReportMoney(summary.netSales, summary.currency),
        },
        {
          label: t("dailySummary.shrinkageCost"),
          value: formatReportMoney(summary.shrinkageCost, summary.currency),
        },
        {
          label: t("dailySummary.recoverySales"),
          value: formatReportMoney(summary.recoverySales, summary.currency),
        },
        ...(summary.transactionCount === undefined
          ? []
          : [
              {
                label: t("dailySummary.transactionCount"),
                value: String(summary.transactionCount),
              },
            ]),
        {
          label: t("dailySummary.paymentSuccessRate"),
          value: `${Math.round((summary.paymentSuccessRate || 0) * 100)}%`,
        },
      ]
    : [];

  if (loading && storeId) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ p: 3 }}>
          <LoadingState message={t("dashboard.sales.loading")} />
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
              bgcolor: "primary.main",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.9,
            }}
          >
            <PointOfSaleIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t("dashboard.sales.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.sales.subtitle")}
            </Typography>
          </Box>
        </Box>

        {!storeId ? (
          <Typography color="error" variant="body2">
            {t("dashboard.inventory.noStore")}
          </Typography>
        ) : error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : metrics.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("dailySummary.noData")}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 1.5,
            }}
          >
            {metrics.map((metric) => (
              <Box
                key={metric.label}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {metric.label}
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {metric.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesCard;

SalesCard.propTypes = {
  date: PropTypes.string,
  storeId: PropTypes.string,
};
