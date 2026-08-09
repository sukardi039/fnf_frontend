import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { Store as StoreIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { AuthContext } from "../../context/authContext";
import { request } from "../../helpers/axios_helper";
import { listStores } from "../../helpers/store_helper";
import { listInventorySnapshots } from "../../helpers/inventory_helper";

const REASON_CODES = ["SPOILAGE", "MISHANDLING", "THEFT", "OTHER"];

const LossEventForm = () => {
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loadingStores, setLoadingStores] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [form, setForm] = useState({
    lotId: "",
    skuId: "",
    quantity: "",
    uom: "",
    reasonCode: "SPOILAGE",
    note: "",
  });

  useEffect(() => {
    let active = true;
    const loadStores = async () => {
      setLoadingStores(true);
      try {
        const response = await listStores({
          companyId: userInfo?.companyId,
          active: true,
        });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : Array.isArray(response.data)
            ? response.data
            : [];
        if (!active) return;
        setStores(items);
        if (items.length === 1) {
          setSelectedStoreId(String(items[0].storeId || items[0].id || ""));
        }
      } catch {
        // best-effort
      } finally {
        if (active) setLoadingStores(false);
      }
    };
    loadStores();
    return () => {
      active = false;
    };
  }, [userInfo?.companyId]);

  useEffect(() => {
    let active = true;
    const loadSnapshots = async () => {
      if (!selectedStoreId) {
        setSnapshots([]);
        setLoadingSnapshots(false);
        return;
      }
      setLoadingSnapshots(true);
      try {
        const response = await listInventorySnapshots({
          storeId: selectedStoreId,
          includeLots: true,
          pageSize: 500,
        });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (!active) return;
        setSnapshots(items);
      } catch {
        if (!active) return;
        setError(t("lossEvent.loadSnapshotsFailed"));
      } finally {
        if (active) setLoadingSnapshots(false);
      }
    };

    loadSnapshots();
    return () => {
      active = false;
    };
  }, [t, selectedStoreId]);

  const lotOptions = useMemo(() => {
    const options = [];
    snapshots.forEach((snapshot) => {
      (snapshot.lots || []).forEach((lot) => {
        options.push({
          lotId: lot.lotId,
          skuId: snapshot.skuId,
          productName: snapshot.productName,
          uom: snapshot.uom,
          availableQuantity: lot.availableQuantity,
        });
      });
    });
    return options;
  }, [snapshots]);

  const handleLotChange = (event) => {
    const lotId = event.target.value;
    const selected = lotOptions.find((lot) => lot.lotId === lotId);
    setForm((current) => ({
      ...current,
      lotId,
      skuId: selected?.skuId || "",
      uom: selected?.uom || "",
      quantity: "",
    }));
    setErrors((current) => ({ ...current, lotId: "", skuId: "", uom: "" }));
    setError("");
    setResult(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setError("");
    setResult(null);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.lotId) {
      nextErrors.lotId = t("lossEvent.validation.lotRequired");
    }
    if (!form.skuId.trim()) {
      nextErrors.skuId = t("lossEvent.validation.required");
    }
    if (!form.uom.trim()) {
      nextErrors.uom = t("lossEvent.validation.required");
    }
    if (form.quantity === "" || Number(form.quantity) <= 0) {
      nextErrors.quantity = t("lossEvent.validation.quantity");
    }
    if (form.reasonCode === "OTHER" && !form.note.trim()) {
      nextErrors.note = t("lossEvent.validation.noteRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await request(
        "POST",
        "/api/v1/loss-events",
        {
          lotId: form.lotId.trim(),
          skuId: form.skuId.trim(),
          quantity: Number(form.quantity),
          uom: form.uom.trim(),
          reasonCode: form.reasonCode,
          note: form.note.trim() || undefined,
        },
        {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setResult(response.data);
      setForm((current) => ({
        ...current,
        lotId: "",
        skuId: "",
        quantity: "",
        uom: "",
        note: "",
      }));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || t("lossEvent.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("lossEvent.title")}
        subtitle={t("lossEvent.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("lossEvent.created", {
            lossEventId: result.lossEventId,
            remainingQuantity: result.remainingQuantity,
          })}
        </Alert>
      )}

      <Box sx={{ mb: 3, maxWidth: 320 }}>
        <FormControl fullWidth size="small" disabled={loadingStores}>
          <InputLabel id="loss-event-store-label">
            {t("lossEvent.store")}
          </InputLabel>
          <Select
            labelId="loss-event-store-label"
            value={selectedStoreId}
            label={t("lossEvent.store")}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            startAdornment={
              <StoreIcon
                fontSize="small"
                sx={{ mr: 1, color: "text.secondary" }}
              />
            }
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

      {loadingSnapshots ? (
        <LoadingState message={t("common.loading")} />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            maxWidth: 880,
          }}
        >
          <FormControl fullWidth error={Boolean(errors.lotId)}>
            <InputLabel id="loss-event-lot-label">
              {t("lossEvent.lotId")}
            </InputLabel>
            <Select
              labelId="loss-event-lot-label"
              value={form.lotId}
              label={t("lossEvent.lotId")}
              onChange={handleLotChange}
              disabled={!selectedStoreId || lotOptions.length === 0}
            >
              {lotOptions.map((lot) => (
                <MenuItem key={lot.lotId} value={lot.lotId}>
                  {lot.lotId} — {lot.productName} ({t("lossEvent.available")}:{" "}
                  {lot.availableQuantity} {lot.uom})
                </MenuItem>
              ))}
            </Select>
            {errors.lotId && (
              <Typography
                variant="caption"
                color="error"
                sx={{ ml: 1.5, mt: 0.5 }}
              >
                {errors.lotId}
              </Typography>
            )}
          </FormControl>
          <TextField
            label={t("lossEvent.skuId")}
            name="skuId"
            value={form.skuId}
            onChange={handleChange}
            error={Boolean(errors.skuId)}
            helperText={errors.skuId}
            required
            fullWidth
          />
          <TextField
            label={t("lossEvent.quantity")}
            name="quantity"
            type="number"
            value={form.quantity}
            onChange={handleChange}
            inputProps={{ min: 0.001, step: "0.001" }}
            error={Boolean(errors.quantity)}
            helperText={errors.quantity}
            required
            fullWidth
          />
          <TextField
            label={t("lossEvent.uom")}
            name="uom"
            value={form.uom}
            onChange={handleChange}
            error={Boolean(errors.uom)}
            helperText={errors.uom}
            required
            fullWidth
          />
          <TextField
            select
            label={t("lossEvent.reasonCode")}
            name="reasonCode"
            value={form.reasonCode}
            onChange={handleChange}
            fullWidth
          >
            {REASON_CODES.map((reasonCode) => (
              <MenuItem key={reasonCode} value={reasonCode}>
                {t(`lossEvent.reasons.${reasonCode}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("lossEvent.note")}
            name="note"
            value={form.note}
            onChange={handleChange}
            inputProps={{ maxLength: 500 }}
            error={Boolean(errors.note)}
            helperText={errors.note}
            required={form.reasonCode === "OTHER"}
            multiline
            minRows={3}
            fullWidth
          />
        </Box>
      )}

      <Button
        type="submit"
        variant="contained"
        disabled={saving || !selectedStoreId}
        sx={{ mt: 3 }}
      >
        {t("lossEvent.record")}
      </Button>
    </Box>
  );
};

export default LossEventForm;
