import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { AuthContext } from "../../context/authContext";
import { request } from "../../helpers/axios_helper";
import { toLocalISO } from "../../helpers/date_helper";
import { fetchActiveProducts } from "../catalog/productApi";
import { listStores } from "../../helpers/store_helper";

const PurchaseLotReceive = () => {
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [stores, setStores] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loadingScopes, setLoadingScopes] = useState(true);
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

    Promise.all([
      fetchActiveProducts(),
      listStores({ companyId: userInfo?.companyId, active: true }),
      request("GET", "/api/v1/vendors?active=true", null, {
        skipAuthRedirect: true,
        skipBackendErrorDialog: true,
      }),
    ])
      .then(([productsResponse, storesResponse, vendorsResponse]) => {
        if (!active) return;
        setProducts(
          Array.isArray(productsResponse.data?.items)
            ? productsResponse.data.items
            : [],
        );
        const storeItems = Array.isArray(storesResponse.data?.items)
          ? storesResponse.data.items
          : Array.isArray(storesResponse.data)
            ? storesResponse.data
            : [];
        setStores(storeItems);
        const vendorItems = Array.isArray(vendorsResponse.data)
          ? vendorsResponse.data
          : Array.isArray(vendorsResponse.data?.items)
            ? vendorsResponse.data.items
            : [];
        setVendors(vendorItems);
        if (storeItems.length === 1) {
          setForm((current) => ({
            ...current,
            storeId: String(storeItems[0].storeId || storeItems[0].id || ""),
          }));
        }
      })
      .catch(() => {
        if (active) setError(t("purchaseLot.scopesUnavailable"));
      })
      .finally(() => {
        if (active) {
          setLoadingProducts(false);
          setLoadingScopes(false);
        }
      });

    return () => {
      active = false;
    };
  }, [t, userInfo?.companyId]);

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

  const handleStoreChange = (event) => {
    setForm((current) => ({
      ...current,
      storeId: event.target.value,
    }));
    setErrors((current) => ({ ...current, storeId: "" }));
    setError("");
    setResult(null);
  };

  const handleSupplierChange = (event) => {
    setForm((current) => ({
      ...current,
      supplierId: event.target.value,
    }));
    setErrors((current) => ({ ...current, supplierId: "" }));
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
        "/api/v1/lots/receive",
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

  if (loadingProducts || loadingScopes) {
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
        <FormControl fullWidth error={Boolean(errors.storeId)} required>
          <InputLabel id="purchase-lot-store-label">
            {t("purchaseLot.storeId")}
          </InputLabel>
          <Select
            labelId="purchase-lot-store-label"
            value={form.storeId}
            label={t("purchaseLot.storeId")}
            onChange={handleStoreChange}
          >
            {stores.map((store) => (
              <MenuItem
                key={store.storeId || store.id}
                value={String(store.storeId || store.id)}
              >
                {store.storeName || store.name || store.storeId || store.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth error={Boolean(errors.supplierId)} required>
          <InputLabel id="purchase-lot-supplier-label">
            {t("purchaseLot.supplierId")}
          </InputLabel>
          <Select
            labelId="purchase-lot-supplier-label"
            value={form.supplierId}
            label={t("purchaseLot.supplierId")}
            onChange={handleSupplierChange}
          >
            {vendors.map((vendor) => (
              <MenuItem
                key={vendor.vendorId || vendor.id}
                value={String(vendor.vendorId || vendor.id)}
              >
                {vendor.vendorName ||
                  vendor.name ||
                  vendor.vendorId ||
                  vendor.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
