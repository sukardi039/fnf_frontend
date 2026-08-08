import React, { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { request } from "../../helpers/axios_helper";

const DISCOUNT_TYPES = ["PERCENT", "FIXED_AMOUNT"];

const PriceRuleForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState("error");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    ruleName: "",
    skuId: "",
    discountType: "PERCENT",
    discountValue: "",
    startAt: "",
    endAt: "",
    priority: "0",
  });

  useEffect(() => {
    let active = true;

    request("GET", "/api/products?active=true", null, {
      skipAuthRedirect: true,
      skipBackendErrorDialog: true,
    })
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
    try {
      const response = await request(
        "POST",
        "/api/price-rules",
        {
          ruleName: form.ruleName.trim(),
          skuId: form.skuId,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          priority: Number(form.priority),
        },
        {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setMessageSeverity("success");
      setMessage(
        t("priceRule.created", {
          ruleId: response.data.ruleId,
          status: response.data.status,
        }),
      );
    } catch (requestError) {
      setMessageSeverity("error");
      setMessage(
        requestError?.response?.data?.message || t("priceRule.createFailed"),
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
        title={t("priceRule.title")}
        subtitle={t("priceRule.subtitle")}
        showBackButton
        onBack={() => navigate("/product")}
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
        <Button variant="outlined" onClick={() => navigate("/product")}>
          {t("basic.cancel")}
        </Button>
      </Box>
    </Box>
  );
};

export default PriceRuleForm;
