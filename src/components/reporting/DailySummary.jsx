import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { Assessment as AssessmentIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { PageHeader, LoadingState, EmptyState } from "../common";
import { useStoreLocation } from "../../context/storeLocationContext";
import {
  formatReportMoney,
  getDailySummary,
} from "../../helpers/reporting_helper";
import { toLocalDate } from "../../helpers/date_helper";

export default function DailySummary() {
  const { t } = useTranslation();
  const { storeId: selectedStoreId } = useStoreLocation();
  const [date, setDate] = useState(() => toLocalDate());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    if (!selectedStoreId || !date) {
      setError(t("dailySummary.selectStoreAndDate"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await getDailySummary({ storeId: selectedStoreId, date });
      setSummary(response.data);
    } catch (err) {
      setSummary(null);
      setError(err?.response?.data?.message || t("dailySummary.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      { label: t("dailySummary.grossSales"), value: formatReportMoney(summary.grossSales, summary.currency) },
      { label: t("dailySummary.netSales"), value: formatReportMoney(summary.netSales, summary.currency) },
      { label: t("dailySummary.shrinkageCost"), value: formatReportMoney(summary.shrinkageCost, summary.currency) },
      { label: t("dailySummary.recoverySales"), value: formatReportMoney(summary.recoverySales, summary.currency) },
      { label: t("dailySummary.inventoryValue"), value: formatReportMoney(summary.inventoryValue, summary.currency) },
      { label: t("dailySummary.reconciliationVarianceCost"), value: formatReportMoney(summary.reconciliationVarianceCost, summary.currency) },
      { label: t("dailySummary.paymentSuccessRate"), value: `${Math.round((summary.paymentSuccessRate || 0) * 100)}%` },
    ];
  }, [summary, t]);

  return (
    <Box>
      <PageHeader
        title={t("dailySummary.title")}
        subtitle={t("dailySummary.subtitle")}
        icon={AssessmentIcon}
      />

      <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          type="date"
          size="small"
          label={t("dailySummary.date")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadSummary}
          disabled={loading || !selectedStoreId || !date}
        >
          {t("dailySummary.load")}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && <LoadingState message={t("common.loading")} />}

      {!loading && !summary && !error && (
        <EmptyState
          title={t("dailySummary.noData")}
          description={t("dailySummary.noDataDescription")}
        />
      )}

      {!loading && summary && (
        <Grid container spacing={2}>
          {metrics.map((metric) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={metric.label}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {metric.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {metric.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
