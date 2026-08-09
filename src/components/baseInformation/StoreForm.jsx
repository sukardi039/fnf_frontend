import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
} from "@mui/material";
import { MyLocation as GpsIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { createStore, updateStore } from "../../helpers/store_api";

const StoreForm = ({ store, onCancel }) => {
  const { t } = useTranslation();
  const isEdit = Boolean(store);
  const [form, setForm] = useState({
    storeId: "",
    storeName: "",
    companyId: "",
    timezone: "Asia/Singapore",
    address: "",
    latitude: "",
    longitude: "",
    active: true,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (store) {
      setForm({
        storeId: store.storeId || "",
        storeName: store.storeName || "",
        companyId: store.companyId || "",
        timezone: store.timezone || "Asia/Singapore",
        address: store.address || "",
        latitude: store.latitude ?? "",
        longitude: store.longitude ?? "",
        active: store.active !== false,
      });
    }
  }, [store]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setError("");
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.storeId.trim()) {
      nextErrors.storeId = t("storeList.validation.storeIdRequired");
    }
    if (!form.storeName.trim()) {
      nextErrors.storeName = t("storeList.validation.storeNameRequired");
    }
    if (!form.companyId.trim()) {
      nextErrors.companyId = t("storeList.validation.companyIdRequired");
    }
    if (!form.timezone.trim()) {
      nextErrors.timezone = t("storeList.validation.timezoneRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGetGpsCoordinates = () => {
    if (!navigator.geolocation) {
      setError(t("storeList.gpsNotSupported"));
      return;
    }
    setGpsLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setGpsLoading(false);
      },
      (err) => {
        setError(t("storeList.gpsFailed", { message: err.message }));
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError("");
    try {
      const payload = {
        storeId: form.storeId.trim(),
        storeName: form.storeName.trim(),
        companyId: form.companyId.trim(),
        timezone: form.timezone.trim(),
        address: form.address.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        active: form.active,
      };

      if (isEdit) {
        await updateStore(store.storeId, payload);
      } else {
        await createStore(payload);
      }
      onCancel(true);
    } catch (err) {
      setError(err?.response?.data?.message || t("storeList.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={isEdit ? t("storeList.editTitle") : t("storeList.addTitle")}
        subtitle={
          isEdit ? t("storeList.editSubtitle") : t("storeList.addSubtitle")
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 880 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          maxWidth: 880,
        }}
      >
        <TextField
          label={t("storeList.storeId")}
          name="storeId"
          value={form.storeId}
          onChange={handleChange}
          disabled={isEdit}
          required
          fullWidth
          error={Boolean(errors.storeId)}
          helperText={errors.storeId}
        />
        <TextField
          label={t("storeList.storeName")}
          name="storeName"
          value={form.storeName}
          onChange={handleChange}
          required
          fullWidth
          error={Boolean(errors.storeName)}
          helperText={errors.storeName}
        />
        <TextField
          label={t("storeList.companyId")}
          name="companyId"
          value={form.companyId}
          onChange={handleChange}
          required
          fullWidth
          error={Boolean(errors.companyId)}
          helperText={errors.companyId}
        />
        <TextField
          label={t("storeList.timezone")}
          name="timezone"
          value={form.timezone}
          onChange={handleChange}
          required
          fullWidth
          error={Boolean(errors.timezone)}
          helperText={errors.timezone}
        />
        <TextField
          label={t("storeList.address")}
          name="address"
          value={form.address}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label={t("storeList.latitude")}
          name="latitude"
          value={form.latitude}
          onChange={handleChange}
          type="number"
          inputProps={{ step: "any" }}
          fullWidth
        />
        <TextField
          label={t("storeList.longitude")}
          name="longitude"
          value={form.longitude}
          onChange={handleChange}
          type="number"
          inputProps={{ step: "any" }}
          fullWidth
        />
        <FormControlLabel
          control={
            <Checkbox
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
          }
          label={t("storeList.active")}
        />
      </Box>

      <Box
        sx={{ mt: 3, display: "flex", gap: 2, maxWidth: 880, flexWrap: "wrap" }}
      >
        <Button
          type="button"
          variant="outlined"
          startIcon={<GpsIcon />}
          onClick={handleGetGpsCoordinates}
          disabled={gpsLoading}
        >
          {gpsLoading
            ? t("storeList.gettingGps")
            : t("storeList.getGpsCoordinates")}
        </Button>
        <Button type="submit" variant="contained" disabled={loading}>
          {t("basic.save")}
        </Button>
        <Button
          variant="outlined"
          onClick={() => onCancel(false)}
          disabled={loading}
        >
          {t("basic.cancel")}
        </Button>
      </Box>
    </Box>
  );
};

export default StoreForm;
