import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import {
  createPriceRule,
  fetchActiveProducts,
  updatePriceRule,
} from "./productApi";

const DISCOUNT_TYPES = ["PERCENT", "FIXED_AMOUNT"];
const BASE_UNITS = ["CENT", "TEN_CENT", "DOLLAR"];
const ROUNDING_MODES = ["UP", "HALF_UP", "FLOOR"];

const toDatetimeLocal = (isoString) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return "";
  }
};

const PriceRuleForm = ({ priceRule }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEdit = Boolean(priceRule?.ruleId);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState("error");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    ruleName: "",
    slogan: "",
    skuId: "",
    discountType: "PERCENT",
    discountValue: "",
    baseUnit: "CENT",
    roundingMode: "HALF_UP",
    startAt: "",
    endAt: "",
    priority: "0",
  });

  useEffect(() => {
    if (!isEdit) return;
    setForm({
      ruleName: priceRule.ruleName || "",
      slogan: priceRule.slogan || "",
      skuId: priceRule.skuId || "",
      discountType: priceRule.discountType || "PERCENT",
      discountValue:
        priceRule.discountValue === undefined || priceRule.discountValue === null
          ? ""
          : String(priceRule.discountValue),
      baseUnit: priceRule.baseUnit || "CENT",
      roundingMode: priceRule.roundingMode || "HALF_UP",
      startAt: toDatetimeLocal(priceRule.startAt),
      endAt: toDatetimeLocal(priceRule.endAt),
      priority:
        priceRule.priority === undefined || priceRule.priority === null
          ? "0"
          : String(priceRule.priority),
    });
  }, [isEdit, priceRule]);

  useEffect(() => {
    let active = true;

    fetchActiveProducts()
      .then((response) => {
        if (!active) return;
        setProducts(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      })
      .catch(() => {
        if (active) setMessage(t("priceRule.productsUnavailable"));
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.ruleName.trim()) {
      nextErrors.ruleName = t("priceRule.validation.ruleNameRequired");
    }
    if (!form.skuId) {
      nextErrors.skuId = t("priceRule.validation.skuRequired");
    }
    if (form.discountValue === "" || Number(form.discountValue) <= 0) {
      nextErrors.discountValue = t(
        "priceRule.validation.discountValueRequired",
      );
    }
    if (!form.startAt) {
      nextErrors.startAt = t("priceRule.validation.startRequired");
    }
    if (!form.endAt || (form.startAt && form.endAt <= form.startAt)) {
      nextErrors.endAt = t("priceRule.validation.endAfterStart");
    }
    if (form.priority === "" || Number(form.priority) < 0) {
      nextErrors.priority = t("priceRule.validation.priorityRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setMessage("");
    const payload = {
      ruleName: form.ruleName.trim(),
      slogan: form.slogan.trim(),
      skuId: form.skuId,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      baseUnit: form.baseUnit,
      roundingMode: form.roundingMode,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      priority: Number(form.priority),
    };
    try {
      const response = isEdit
        ? await updatePriceRule(priceRule.ruleId, payload)
        : await createPriceRule(payload);
      setMessageSeverity("success");
      setMessage(
        t(isEdit ? "priceRule.updated" : "priceRule.created", {
          ruleId: response.data.ruleId,
          status: response.data.status,
        }),
      );
      setTimeout(() => navigate("/price-rules"), 600);
    } catch (requestError) {
      setMessageSeverity("error");
      setMessage(
        requestError?.response?.data?.message ||
          t(isEdit ? "priceRule.updateFailed" : "priceRule.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingProducts) {
    return <LoadingState message={t("priceRule.loadingProducts")} />;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t(isEdit ? "priceRule.editTitle" : "priceRule.title")}
        subtitle={t("priceRule.subtitle")}
        showBackButton
        onBack={() => navigate("/price-rules")}
        backLabel={t("basic.back")}
      />

      {message && (
        <Alert severity={messageSeverity} sx={{ mb: 2 }}>
          {message}
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
          label={t("priceRule.ruleName")}
          name="ruleName"
          value={form.ruleName}
          onChange={handleChange}
          error={Boolean(errors.ruleName)}
          helperText={errors.ruleName}
          required
          fullWidth
        />
        <TextField
          label={t("priceRule.slogan")}
          name="slogan"
          value={form.slogan}
          onChange={handleChange}
          placeholder={t("priceRule.sloganPlaceholder")}
          fullWidth
        />
        <TextField
          select
          label={t("priceRule.product")}
          name="skuId"
          value={form.skuId}
          onChange={handleChange}
          error={Boolean(errors.skuId)}
          helperText={errors.skuId}
          required
          fullWidth
        >
          {products.map((product) => (
            <MenuItem key={product.skuId} value={product.skuId}>
              {product.productName} ({product.productCode})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("priceRule.discountType")}
          name="discountType"
          value={form.discountType}
          onChange={handleChange}
          fullWidth
        >
          {DISCOUNT_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {t(`priceRule.discountTypes.${type}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("priceRule.discountValue")}
          name="discountValue"
          type="number"
          value={form.discountValue}
          onChange={handleChange}
          inputProps={{ min: 0.0001, step: "0.0001" }}
          error={Boolean(errors.discountValue)}
          helperText={errors.discountValue}
          required
          fullWidth
        />
        <TextField
          select
          label={t("priceRule.baseUnit")}
          name="baseUnit"
          value={form.baseUnit}
          onChange={handleChange}
          required
          fullWidth
        >
          {BASE_UNITS.map((unit) => (
            <MenuItem key={unit} value={unit}>
              {t(`priceRule.baseUnits.${unit}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("priceRule.roundingMode")}
          name="roundingMode"
          value={form.roundingMode}
          onChange={handleChange}
          required
          fullWidth
        >
          {ROUNDING_MODES.map((mode) => (
            <MenuItem key={mode} value={mode}>
              {t(`priceRule.roundingModes.${mode}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("priceRule.startAt")}
          name="startAt"
          type="datetime-local"
          value={form.startAt}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.startAt)}
          helperText={errors.startAt}
          required
          fullWidth
        />
        <TextField
          label={t("priceRule.endAt")}
          name="endAt"
          type="datetime-local"
          value={form.endAt}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.endAt)}
          helperText={errors.endAt}
          required
          fullWidth
        />
        <TextField
          label={t("priceRule.priority")}
          name="priority"
          type="number"
          value={form.priority}
          onChange={handleChange}
          inputProps={{ min: 0, step: 1 }}
          error={Boolean(errors.priority)}
          helperText={errors.priority}
          required
          fullWidth
        />
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Button type="submit" variant="contained" disabled={saving}>
          {t("basic.save")}
        </Button>
        <Button variant="outlined" onClick={() => navigate("/price-rules")}>
          {t("basic.cancel")}
        </Button>
      </Box>
    </Box>
  );
};

PriceRuleForm.propTypes = {
  priceRule: PropTypes.shape({
    ruleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    ruleName: PropTypes.string,
    slogan: PropTypes.string,
    skuId: PropTypes.string,
    discountType: PropTypes.string,
    discountValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    baseUnit: PropTypes.string,
    roundingMode: PropTypes.string,
    startAt: PropTypes.string,
    endAt: PropTypes.string,
    priority: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

export default PriceRuleForm;
