import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { AccountBalance as AccountBalanceIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { PageHeader, LoadingState, EmptyState } from "../common";
import { useStoreLocation } from "../../context/storeLocationContext";
import { listInventorySnapshots } from "../../helpers/inventory_helper";
import { submitReconciliation } from "../../helpers/reporting_helper";

export default function Reconciliation() {
  const { t } = useTranslation();
  const { storeId: selectedStoreId } = useStoreLocation();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [snapshots, setSnapshots] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setResult(null);
      setError("");
      if (!selectedStoreId) {
        setSnapshots([]);
        return;
      }
      setLoading(true);
      try {
        const response = await listInventorySnapshots({
          storeId: selectedStoreId,
          includeLots: false,
          pageSize: 500,
        });
        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        if (!active) return;
        setSnapshots(items);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("reconciliation.loadSnapshotsFailed"));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t, selectedStoreId]);

  const normalizedRows = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        id: snapshot.snapshotId,
        skuId: snapshot.skuId,
        productName: snapshot.productName,
        uom: snapshot.uom,
        onHandQuantity: snapshot.onHandQuantity,
      })),
    [snapshots],
  );

  const updateCount = (skuId, value) => {
    setCounts((prev) => ({ ...prev, [skuId]: value }));
  };

  const validate = () => {
    if (!selectedStoreId || !businessDate) return false;
    const hasValue = normalizedRows.some((row) => {
      const value = counts[row.skuId];
      return value !== undefined && value !== "" && Number(value) >= 0;
    });
    return hasValue;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      setError(t("reconciliation.validationError"));
      return;
    }
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const lines = normalizedRows
        .map((row) => {
          const value = counts[row.skuId];
          if (value === undefined || value === "") return null;
          return { skuId: row.skuId, countedQuantity: Number(value) };
        })
        .filter(Boolean);
      const response = await submitReconciliation({
        storeId: selectedStoreId,
        businessDate,
        lines,
      });
      setResult(response.data);
      setCounts({});
    } catch (err) {
      setError(err?.response?.data?.message || t("reconciliation.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <PageHeader
        title={t("reconciliation.title")}
        subtitle={t("reconciliation.subtitle")}
        icon={AccountBalanceIcon}
      />

      <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          type="date"
          size="small"
          label={t("reconciliation.businessDate")}
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t("reconciliation.created", { reconciliationId: result.reconciliationId, status: result.status })}
        </Alert>
      )}

      {loading && <LoadingState message={t("common.loading")} />}

      {!loading && normalizedRows.length === 0 && !error && (
        <EmptyState
          title={t("reconciliation.noData")}
          description={selectedStoreId ? t("reconciliation.noSnapshots") : t("reconciliation.selectStore")}
        />
      )}

      {!loading && normalizedRows.length > 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("reconciliation.sku")}</TableCell>
                    <TableCell>{t("reconciliation.product")}</TableCell>
                    <TableCell>{t("reconciliation.onHand")}</TableCell>
                    <TableCell>{t("reconciliation.countedQuantity")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {normalizedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.skuId}</TableCell>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell>
                        {row.onHandQuantity} {row.uom}
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          value={counts[row.skuId] || ""}
                          onChange={(e) => updateCount(row.skuId, e.target.value)}
                          inputProps={{ min: 0, step: "0.001" }}
                          sx={{ minWidth: 120 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" disabled={saving || !validate()}>
              {saving ? t("common.saving") : t("reconciliation.submit")}
            </Button>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
