import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { generateProductCode } from "../../helpers/itemcode_helper";

const PRODUCT_FORMATS = ["WHOLE", "CUT", "JUICE"];
const UOM_OPTIONS = ["EA", "KG", "G", "L", "ML"];

const ProductForm = ({ companyId, onCancel }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    productCode: generateProductCode(companyId),
    productName: "",
    format: "WHOLE",
    uom: "EA",
    price: "",
    currency: "SGD",
    active: true,
  }));
  const [errors, setErrors] = useState({});
  const [backendPending, setBackendPending] = useState(false);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setBackendPending(false);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.productName.trim()) {
      nextErrors.productName = t("product.validation.nameRequired");
    }
    if (form.price === "" || Number(form.price) < 0) {
      nextErrors.price = t("product.validation.priceRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    setBackendPending(true);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("product.addTitle")}
        subtitle={t("product.formSubtitle")}
        showBackButton
        onBack={() => onCancel(false)}
        backLabel={t("basic.back")}
      />

      {backendPending && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("product.writeBackendPending")}
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

      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Button type="submit" variant="contained">
          {t("basic.save")}
        </Button>
        <Button variant="outlined" onClick={() => onCancel(false)}>
          {t("basic.cancel")}
        </Button>
      </Box>
    </Box>
  );
};

ProductForm.propTypes = {
  companyId: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
};

export default ProductForm;
