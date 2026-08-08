import React, { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { request } from "../../helpers/axios_helper";
import { toLocalISO } from "../../helpers/date_helper";
import { fetchActiveProducts } from "../catalog/productApi";

const PurchaseLotReceive = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    storeId: "",
    supplierId: "",
    skuId: "",
    supplierLotRef: "",
    quantity: "",
    uom: "",
    totalCost: "",
    receivedAt: toLocalISO().slice(0, 16),
    expiryDate: "",
  });

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
        if (active) setError(t("purchaseLot.productsUnavailable"));
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
    setError("");
    setResult(null);
  };

  const handleProductChange = (event) => {
    const selectedSkuId = event.target.value;
    const product = products.find((item) => item.skuId === selectedSkuId);
    setForm((current) => ({
      ...current,
      skuId: selectedSkuId,
      uom: product?.uom || "",
    }));
    setErrors((current) => ({ ...current, skuId: "" }));
    setError("");
    setResult(null);
  };

  const validate = () => {
    const nextErrors = {};
    ["storeId", "supplierId", "skuId", "receivedAt"].forEach((field) => {
      if (!form[field])
        nextErrors[field] = t("purchaseLot.validation.required");
    });
    if (form.quantity === "" || Number(form.quantity) <= 0) {
      nextErrors.quantity = t("purchaseLot.validation.quantity");
    }
    if (form.totalCost === "" || Number(form.totalCost) < 0) {
      nextErrors.totalCost = t("purchaseLot.validation.totalCost");
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
        "/api/lots/receive",
        {
          storeId: form.storeId.trim(),
          supplierId: form.supplierId.trim(),
          skuId: form.skuId,
          supplierLotRef: form.supplierLotRef.trim() || undefined,
          quantity: Number(form.quantity),
          uom: form.uom,
          totalCost: Number(form.totalCost),
          receivedAt: new Date(form.receivedAt).toISOString(),
          expiryDate: form.expiryDate || undefined,
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
        requestError?.response?.data?.message || t("purchaseLot.receiveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingProducts) {
    return <LoadingState message={t("purchaseLot.loadingProducts")} />;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("purchaseLot.title")}
        subtitle={t("purchaseLot.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("purchaseLot.received", {
            lotId: result.lotId,
            quantity: result.availableQuantity,
            movementId: result.inventoryMovementId,
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
          label={t("purchaseLot.storeId")}
          name="storeId"
          value={form.storeId}
          onChange={handleChange}
          error={Boolean(errors.storeId)}
          helperText={errors.storeId}
          required
          fullWidth
        />
        <TextField
          label={t("purchaseLot.supplierId")}
          name="supplierId"
          value={form.supplierId}
          onChange={handleChange}
          error={Boolean(errors.supplierId)}
          helperText={errors.supplierId}
          required
          fullWidth
        />
        <TextField
          select
          label={t("purchaseLot.product")}
          name="skuId"
          value={form.skuId}
          onChange={handleProductChange}
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
          label={t("purchaseLot.supplierLotRef")}
          name="supplierLotRef"
          value={form.supplierLotRef}
          onChange={handleChange}
          inputProps={{ maxLength: 100 }}
          fullWidth
        />
        <TextField
          label={t("purchaseLot.quantity")}
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
          label={t("purchaseLot.uom")}
          value={form.uom}
          inputProps={{ readOnly: true }}
          required
          fullWidth
        />
        <TextField
          label={t("purchaseLot.totalCost")}
          name="totalCost"
          type="number"
          value={form.totalCost}
          onChange={handleChange}
          inputProps={{ min: 0, step: "0.0001" }}
          error={Boolean(errors.totalCost)}
          helperText={errors.totalCost}
          required
          fullWidth
        />
        <TextField
          label={t("purchaseLot.receivedAt")}
          name="receivedAt"
          type="datetime-local"
          value={form.receivedAt}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.receivedAt)}
          helperText={errors.receivedAt}
          required
          fullWidth
        />
        <TextField
          label={t("purchaseLot.expiryDate")}
          name="expiryDate"
          type="date"
          value={form.expiryDate}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Box>

      <Button
        type="submit"
        variant="contained"
        disabled={saving}
        sx={{ mt: 3 }}
      >
        {t("purchaseLot.receive")}
      </Button>
    </Box>
  );
};

export default PurchaseLotReceive;
