import React, { useState } from "react";
import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { request } from "../../helpers/axios_helper";

const REASON_CODES = ["SPOILAGE", "MISHANDLING", "THEFT", "OTHER"];

const LossEventForm = () => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    lotId: "",
    skuId: "",
    quantity: "",
    uom: "",
    reasonCode: "SPOILAGE",
    note: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setError("");
    setResult(null);
  };

  const validate = () => {
    const nextErrors = {};
    ["lotId", "skuId", "uom"].forEach((field) => {
      if (!form[field].trim()) {
        nextErrors[field] = t("lossEvent.validation.required");
      }
    });
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
        "/api/loss-events",
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

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          maxWidth: 880,
        }}
      >
        <TextField
          label={t("lossEvent.lotId")}
          name="lotId"
          value={form.lotId}
          onChange={handleChange}
          error={Boolean(errors.lotId)}
          helperText={errors.lotId}
          required
          fullWidth
        />
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

      <Button
        type="submit"
        variant="contained"
        disabled={saving}
        sx={{ mt: 3 }}
      >
        {t("lossEvent.record")}
      </Button>
    </Box>
  );
};

export default LossEventForm;
