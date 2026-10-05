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
import { getDailySummary } from "../../helpers/reporting_helper";

function formatMoney(money) {
  if (!money || typeof money.amount !== "number") return "—";
  const value = Number(money.amount).toFixed(2);
  return money.currency ? `${money.currency} ${value}` : value;
}

export default function DailySummary() {
  const { t } = useTranslation();
  const { storeId: selectedStoreId } = useStoreLocation();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
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
      { label: t("dailySummary.grossSales"), value: formatMoney(summary.grossSales) },
      { label: t("dailySummary.netSales"), value: formatMoney(summary.netSales) },
      { label: t("dailySummary.shrinkageCost"), value: formatMoney(summary.shrinkageCost) },
      { label: t("dailySummary.recoverySales"), value: formatMoney(summary.recoverySales) },
      { label: t("dailySummary.inventoryValue"), value: formatMoney(summary.inventoryValue) },
      { label: t("dailySummary.reconciliationVarianceCost"), value: formatMoney(summary.reconciliationVarianceCost) },
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
