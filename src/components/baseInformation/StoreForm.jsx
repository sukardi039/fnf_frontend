import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { MyLocation as GpsIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { createStore, getStore, updateStore } from "../../helpers/store_api";
import { emptyBusinessHours, validateBusinessHours, WEEKDAYS } from "../../helpers/store_hours_helper";

const StoreForm = ({ store, onCancel }) => {
  return <StoreFormFields key={store?.storeId || "new"} store={store} onCancel={onCancel} />;
};

const StoreFormFields = ({ store, onCancel }) => {
  const { t } = useTranslation();
  const isEdit = Boolean(store);
  const [form, setForm] = useState(() => ({
    storeId: store?.storeId || "",
    storeName: store?.storeName || "",
    companyId: store?.companyId || "",
    timezone: store?.timezone || "Asia/Singapore",
    address: store?.address || "",
    latitude: store?.latitude ?? "",
    longitude: store?.longitude ?? "",
    active: store?.active !== false,
    businessHours: store?.businessHours || emptyBusinessHours(),
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveNeedsReload, setSaveNeedsReload] = useState(false);

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
    } else {
      try {
        new Intl.DateTimeFormat("en", { timeZone: form.timezone.trim() }).format();
      } catch {
        nextErrors.timezone = t("storeList.validation.timezoneInvalid");
      }
    }
    try {
      validateBusinessHours(form.businessHours);
    } catch (hoursError) {
      nextErrors.businessHours = t(hoursError.message);
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
    let saved = false;
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
        businessHours: form.businessHours,
      };

      if (isEdit) {
        await updateStore(store.storeId, payload);
      } else {
        await createStore(payload);
      }
      saved = true;
      const response = await getStore(payload.storeId);
      const returnedHours = validateBusinessHours(response?.data?.businessHours);
      const signature = (periods) => JSON.stringify(periods.map(({ opensAt, closesAt }) =>
        ({ opensAt, closesAt })).sort((left, right) => left.opensAt.localeCompare(right.opensAt)));
      if (!WEEKDAYS.every((day) =>
        signature(returnedHours[day]) === signature(payload.businessHours[day]))) {
        throw new Error("storeList.hoursUnconfirmed");
      }
      onCancel(true);
    } catch (err) {
      setSaveNeedsReload(saved);
      setError(saved ? t("storeList.hoursUnconfirmed") : err?.response?.data?.message ||
        (err?.message?.startsWith("storeList.") ? t(err.message) : err?.message) ||
        t("storeList.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  const changeHours = (day, periods) => {
    setForm((current) => ({
      ...current, businessHours: { ...current.businessHours, [day]: periods },
    }));
    setErrors((current) => ({ ...current, businessHours: "" }));
    setError("");
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

      <Box sx={{ mt: 3, maxWidth: 880 }}>
        <Typography variant="h6">{t("storeList.businessHours")}</Typography>
        <Typography sx={{ mb: 2 }}>{t("storeList.hoursHint")}</Typography>
        {!store?.businessHours && isEdit && (
          <Alert severity="warning" sx={{ mb: 2 }}>{t("storeList.hoursMissing")}</Alert>
        )}
        {errors.businessHours && <Alert severity="error">{errors.businessHours}</Alert>}
        {WEEKDAYS.map((day) => {
          const periods = Array.isArray(form.businessHours[day]) ? form.businessHours[day] : [];
          return (
            <Box key={day} role="group" aria-label={t(`storeList.weekdays.${day}`)} sx={{ mb: 2 }}>
              <Typography fontWeight={700}>{t(`storeList.weekdays.${day}`)}</Typography>
              {periods.length === 0 && <Typography>{t("storeList.closed")}</Typography>}
              {periods.map((period, index) => (
                <Box key={index} sx={{ display: "flex", gap: 1, my: 1, flexWrap: "wrap" }}>
                  {["opensAt", "closesAt"].map((field) => (
                    <TextField
                      key={field} type="time" size="small" value={period[field]}
                      label={t(`storeList.${field}`)}
                      slotProps={{ inputLabel: { shrink: true } }}
                      disabled={loading}
                      onChange={(event) => changeHours(day, periods.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, [field]: event.target.value } : entry))}
                    />
                  ))}
                  <Button disabled={loading} onClick={() => changeHours(day,
                    periods.filter((_, entryIndex) => entryIndex !== index))}
                    aria-label={t("storeList.removeHours", { day: t(`storeList.weekdays.${day}`), index: index + 1 })}
                  >{t("basic.remove", "Remove")}</Button>
                </Box>
              ))}
              <Button disabled={loading} onClick={() => changeHours(day,
                [...periods, { opensAt: "", closesAt: "" }])}
              >{t("storeList.addHours", { day: t(`storeList.weekdays.${day}`) })}</Button>
            </Box>
          );
        })}
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
        <Button type="submit" variant="contained" disabled={loading || saveNeedsReload}>
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

const formPropTypes = {
  store: PropTypes.shape({
    storeId: PropTypes.string,
    storeName: PropTypes.string,
    companyId: PropTypes.string,
    timezone: PropTypes.string,
    address: PropTypes.string,
    latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    active: PropTypes.bool,
    businessHours: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.shape({
      opensAt: PropTypes.string.isRequired, closesAt: PropTypes.string.isRequired,
    }))),
  }),
  onCancel: PropTypes.func.isRequired,
};
StoreForm.propTypes = formPropTypes;
StoreFormFields.propTypes = formPropTypes;

export default StoreForm;
