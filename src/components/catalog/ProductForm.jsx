import React, { useEffect, useState } from "react";
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
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import FileGallery from "../common/FileGallery";
import {
  commit,
  normalizeFileMetadata,
} from "../../helpers/file_helper";
import { createProduct, fetchProductFormats, updateProduct } from "./productApi";

const UOM_OPTIONS = ["EA", "KG", "G", "L", "ML"];

const ProductForm = ({ product, onCancel }) => {
  const { t } = useTranslation();
  const isEdit = Boolean(product?.productId);
  const [formats, setFormats] = useState([]);
  const [formatsLoading, setFormatsLoading] = useState(true);
  const parseProductPictures = (value) => {
    if (!value) return [];
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter(Boolean).map((p) => normalizeFileMetadata(p));
    } catch {
      return value ? [normalizeFileMetadata(value)] : [];
    }
  };

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        productCode: product.productCode || "",
        productName: product.productName || "",
        format: product.format || "",
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
      productCode: "",
      productName: "",
      format: "",
      uom: "EA",
      price: "",
      currency: "SGD",
      active: true,
    };
  });
  const [productPictures, setProductPictures] = useState(() =>
    parseProductPictures(product?.productPicture),
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setFormatsLoading(true);
      try {
        const response = await fetchProductFormats();
        const items = Array.isArray(response.data) ? response.data : [];
        if (!active) return;
        setFormats(items);
        if (!isEdit && items.length > 0) {
          setForm((current) => ({
            ...current,
            format: current.format || items[0].formatCode,
          }));
        }
      } catch {
        if (!active) return;
        setFormats([]);
      } finally {
        if (active) setFormatsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isEdit]);

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
    const normalizedPictures = productPictures.map((p) =>
      normalizeFileMetadata(p),
    );
    const payload = {
      ...(isEdit ? { productCode: form.productCode } : {}),
      productName: form.productName.trim(),
      format: form.format,
      uom: form.uom,
      price: Number(form.price),
      currency: form.currency,
      active: form.active,
      productPicture:
        normalizedPictures.length > 0
          ? JSON.stringify(normalizedPictures)
          : null,
    };
    try {
      if (isEdit) {
        await updateProduct(product.productId, payload);
      } else {
        await createProduct(payload);
      }
      await commit();
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

  if (formatsLoading) {
    return <LoadingState message={t("product.loading")} />;
  }

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
        {isEdit && (
          <TextField
            label={t("product.productCode")}
            name="productCode"
            value={form.productCode}
            inputProps={{ readOnly: true }}
            fullWidth
          />
        )}
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
          disabled={formatsLoading || formats.length === 0}
          fullWidth
        >
          {formats.map((format) => (
            <MenuItem key={format.formatCode} value={format.formatCode}>
              {format.formatName}
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

      <Box sx={{ mt: 3, maxWidth: 880 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t("product.productPicture", "Product Picture")}
        </Typography>
        <FileGallery
          productPicture={productPictures}
          allowRemove
          allowAdd
          onChange={(json) => {
            try {
              const parsed = json ? JSON.parse(json) : [];
              const arr = Array.isArray(parsed) ? parsed : [parsed];
              setProductPictures(arr.filter(Boolean).map((p) => normalizeFileMetadata(p)));
            } catch {
              setProductPictures([]);
            }
          }}
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
    productPicture: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  }),
  onCancel: PropTypes.func.isRequired,
};

export default ProductForm;
