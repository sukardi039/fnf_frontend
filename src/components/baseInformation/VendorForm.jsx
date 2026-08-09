import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { createVendor, updateVendor } from "../../helpers/vendor_api";

const VendorForm = ({ vendor, onCancel }) => {
  const { t } = useTranslation();
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState({
    vendorId: "",
    vendorName: "",
    contactName: "",
    email: "",
    phone: "",
    active: true,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (vendor) {
      setForm({
        vendorId: vendor.vendorId || "",
        vendorName: vendor.vendorName || "",
        contactName: vendor.contactName || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        active: vendor.active !== false,
      });
    }
  }, [vendor]);

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
    if (!form.vendorId.trim()) {
      nextErrors.vendorId = t("vendorList.validation.vendorIdRequired");
    }
    if (!form.vendorName.trim()) {
      nextErrors.vendorName = t("vendorList.validation.vendorNameRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError("");
    try {
      const payload = {
        vendorId: form.vendorId.trim(),
        vendorName: form.vendorName.trim(),
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        active: form.active,
      };

      if (isEdit) {
        await updateVendor(vendor.vendorId, payload);
      } else {
        await createVendor(payload);
      }
      onCancel(true);
    } catch (err) {
      setError(err?.response?.data?.message || t("vendorList.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={isEdit ? t("vendorList.editTitle") : t("vendorList.addTitle")}
        subtitle={
          isEdit ? t("vendorList.editSubtitle") : t("vendorList.addSubtitle")
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
          label={t("vendorList.vendorId")}
          name="vendorId"
          value={form.vendorId}
          onChange={handleChange}
          disabled={isEdit}
          required
          fullWidth
          error={Boolean(errors.vendorId)}
          helperText={errors.vendorId}
        />
        <TextField
          label={t("vendorList.vendorName")}
          name="vendorName"
          value={form.vendorName}
          onChange={handleChange}
          required
          fullWidth
          error={Boolean(errors.vendorName)}
          helperText={errors.vendorName}
        />
        <TextField
          label={t("vendorList.contactName")}
          name="contactName"
          value={form.contactName}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label={t("vendorList.email")}
          name="email"
          value={form.email}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          label={t("vendorList.phone")}
          name="phone"
          value={form.phone}
          onChange={handleChange}
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
          label={t("vendorList.active")}
        />
      </Box>

      <Box sx={{ mt: 3, display: "flex", gap: 2, maxWidth: 880 }}>
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

export default VendorForm;
