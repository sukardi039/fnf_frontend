import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { generateProductCode } from "../../helpers/itemcode_helper";
import { createProduct, updateProduct } from "./productApi";

const PRODUCT_FORMATS = ["WHOLE", "CUT", "JUICE"];
const UOM_OPTIONS = ["EA", "KG", "G", "L", "ML"];

const ProductForm = ({ product, companyId, onCancel }) => {
  const { t } = useTranslation();
  const isEdit = Boolean(product?.productId);
  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        productCode: product.productCode || "",
        productName: product.productName || "",
        format: product.format || "WHOLE",
        uom: product.uom || "EA",
        price:
          product.price === undefined || product.price === null
            ? ""
            : String(product.price),
        currency: product.currency || "SGD",
        active: product.active !== false,
      };
    }
    return {
      productCode: generateProductCode(companyId),
      productName: "",
      format: "WHOLE",
      uom: "EA",
      price: "",
      currency: "SGD",
      active: true,
    };
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setResult(null);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.productName.trim()) {
      nextErrors.productName = t("product.validation.nameRequired");
    }
    if (form.price === "" || Number(form.price) < 0) {
      nextErrors.price = t("product.validation.priceRequired");
    }
    if (!form.uom) {
      nextErrors.uom = t("product.validation.uomRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setResult(null);
    const payload = {
      productCode: form.productCode,
      productName: form.productName.trim(),
      format: form.format,
      uom: form.uom,
      price: Number(form.price),
      currency: form.currency,
      active: form.active,
    };
    try {
      if (isEdit) {
        await updateProduct(product.productId, payload);
      } else {
        await createProduct(payload);
      }
      setResult({
        severity: "success",
        text: t(isEdit ? "product.updated" : "product.created"),
      });
      setTimeout(() => onCancel(true), 600);
    } catch (err) {
      setResult({
        severity: "error",
        text: err?.response?.data?.message || t("product.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t(isEdit ? "product.editTitle" : "product.addTitle")}
        subtitle={t("product.formSubtitle")}
        showBackButton
        onBack={() => onCancel(false)}
        backLabel={t("basic.back")}
      />

      {result && (
        <Alert severity={result.severity} sx={{ mb: 2 }}>
          {result.text}
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
          label={t("product.productCode")}
          name="productCode"
          value={form.productCode}
          inputProps={{ readOnly: true }}
          fullWidth
        />
        <TextField
          label={t("product.productName")}
          name="productName"
          value={form.productName}
          onChange={handleChange}
          error={Boolean(errors.productName)}
          helperText={errors.productName}
          required
          fullWidth
        />
        <TextField
          select
          label={t("product.format")}
          name="format"
          value={form.format}
          onChange={handleChange}
          fullWidth
        >
          {PRODUCT_FORMATS.map((format) => (
            <MenuItem key={format} value={format}>
              {t(`product.formats.${format}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("product.uom")}
          name="uom"
          value={form.uom}
          onChange={handleChange}
          fullWidth
        >
          {UOM_OPTIONS.map((uom) => (
            <MenuItem key={uom} value={uom}>
              {uom}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("product.price")}
          name="price"
          type="number"
          value={form.price}
          onChange={handleChange}
          inputProps={{ min: 0, step: "0.0001" }}
          error={Boolean(errors.price)}
          helperText={errors.price}
          required
          fullWidth
        />
        <TextField
          label={t("product.currency")}
          name="currency"
          value={form.currency}
          inputProps={{ readOnly: true }}
          fullWidth
        />
        <FormControlLabel
          control={
            <Switch
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
          }
          label={t("product.active")}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 3, alignItems: "center" }}>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            t("basic.save")
          )}
        </Button>
        <Button
          variant="outlined"
          onClick={() => onCancel(false)}
          disabled={saving}
        >
          {t("basic.cancel")}
        </Button>
      </Box>
    </Box>
  );
};

ProductForm.propTypes = {
  product: PropTypes.shape({
    productId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    productCode: PropTypes.string,
    productName: PropTypes.string,
    format: PropTypes.string,
    uom: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    currency: PropTypes.string,
    active: PropTypes.bool,
  }),
  companyId: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
};

export default ProductForm;
