import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { request } from "../../helpers/axios_helper";
import { listStores } from "../../helpers/store_helper";
import { LoadingState } from "../common";

export default function TvDisplayHome() {
  const { t } = useTranslation();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let active = true;
    const loadStores = async () => {
      try {
        const response = await listStores({ active: true });
        if (!active) return;
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : Array.isArray(response.data)
            ? response.data
            : [];
        setStores(items);
        if (items.length === 1) {
          setSelectedStoreId(String(items[0].storeId || items[0].id || ""));
        }
      } catch {
        // best-effort
      } finally {
        if (active) setLoading(false);
      }
    };
    loadStores();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer = null;
    const loadSummary = async () => {
      if (!selectedStoreId) return;
      setLoading(true);
      try {
        const response = await request(
          "GET",
          `/api/v1/reports/daily-summary?date=${today}&storeId=${encodeURIComponent(selectedStoreId)}`,
          null,
          { skipAuthRedirect: true, skipBackendErrorDialog: true },
        );
        if (!active) return;
        setSummary(response.data || null);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("tv.display.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSummary();
    timer = setInterval(loadSummary, 30000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [t, today, selectedStoreId]);

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      { label: t("tv.display.sales"), value: summary.totalSales || 0 },
      {
        label: t("tv.display.transactions"),
        value: summary.transactionCount || 0,
      },
      { label: t("tv.display.itemsSold"), value: summary.itemsSold || 0 },
      { label: t("tv.display.lossValue"), value: summary.lossValue || 0 },
    ];
  }, [summary, t]);

  if (loading && !summary) {
    return <LoadingState message={t("tv.display.loading")} />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        p: 4,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography variant="h2" fontWeight={700}>
          {t("tv.display.title", "Daily Dashboard")}
        </Typography>
        <FormControl sx={{ minWidth: 240 }} size="small">
          <InputLabel>{t("tv.display.store")}</InputLabel>
          <Select
            value={selectedStoreId}
            label={t("tv.display.store")}
            onChange={(e) => setSelectedStoreId(e.target.value)}
          >
            {stores.map((store) => (
              <MenuItem
                key={store.storeId || store.id}
                value={String(store.storeId || store.id)}
              >
                {store.storeName || store.name || store.storeId || store.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {metrics.map((metric) => (
          <Grid item xs={12} sm={6} md={3} key={metric.label}>
            <Paper
              sx={{
                p: 4,
                textAlign: "center",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
              elevation={2}
            >
              <Typography variant="h3" fontWeight={700}>
                {metric.value}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                {metric.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4, textAlign: "right" }}>
        <Typography variant="body2" color="text.secondary">
          {t("tv.display.lastUpdated", {
            time: new Date().toLocaleTimeString(),
          })}
        </Typography>
      </Box>
    </Box>
  );
}
