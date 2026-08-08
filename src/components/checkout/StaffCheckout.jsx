import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Link,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { request } from "../../helpers/axios_helper";
import { fetchActiveProducts } from "../catalog/productApi";

const CHANNELS = ["STORE_SELF_SELECT", "STAFF_ASSISTED", "MOBILE_ORDER"];
const PAYMENT_MODES = ["E_PAYMENT", "CASH", "PAY_AT_COUNTER"];

const StaffCheckout = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cart, setCart] = useState(null);
  const [quote, setQuote] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [cartForm, setCartForm] = useState({
    storeId: "",
    channel: "STAFF_ASSISTED",
    customerId: "",
  });
  const [itemForm, setItemForm] = useState({ skuId: "", quantity: "" });
  const [paymentMode, setPaymentMode] = useState("CASH");

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
        if (active) setError(t("staffCheckout.productsUnavailable"));
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const createCart = async (event) => {
    event.preventDefault();
    if (!cartForm.storeId.trim()) {
      setError(t("staffCheckout.storeRequired"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await request(
        "POST",
        "/api/carts",
        {
          storeId: cartForm.storeId.trim(),
          channel: cartForm.channel,
          customerId: cartForm.customerId.trim() || null,
        },
        { skipAuthRedirect: true, skipBackendErrorDialog: true },
      );
      setCart(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("staffCheckout.createFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (event) => {
    event.preventDefault();
    if (
      !itemForm.skuId ||
      itemForm.quantity === "" ||
      Number(itemForm.quantity) <= 0
    ) {
      setError(t("staffCheckout.itemRequired"));
      return;
    }

    setBusy(true);
    setError("");
    setTransaction(null);
    try {
      const response = await request(
        "POST",
        `/api/carts/${cart.cartId}/items`,
        { skuId: itemForm.skuId, quantity: Number(itemForm.quantity) },
        {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setQuote(response.data);
      setItemForm({ skuId: "", quantity: "" });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || t("staffCheckout.addFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (!quote) return;

    setBusy(true);
    setError("");
    try {
      const response = await request(
        "POST",
        "/api/checkout",
        {
          cartId: cart.cartId,
          quoteId: quote.quoteId,
          paymentMode,
          channel: cartForm.channel,
        },
        {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setTransaction(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("staffCheckout.checkoutFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loadingProducts) {
    return <LoadingState message={t("staffCheckout.loadingProducts")} />;
  }

  return (
    <Box>
      <HeaderBar
        title={t("staffCheckout.title")}
        subtitle={t("staffCheckout.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!cart ? (
        <Box
          component="form"
          onSubmit={createCart}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            maxWidth: 880,
          }}
        >
          <TextField
            label={t("staffCheckout.storeId")}
            value={cartForm.storeId}
            onChange={(event) =>
              setCartForm((current) => ({
                ...current,
                storeId: event.target.value,
              }))
            }
            required
            fullWidth
          />
          <TextField
            select
            label={t("staffCheckout.channel")}
            value={cartForm.channel}
            onChange={(event) =>
              setCartForm((current) => ({
                ...current,
                channel: event.target.value,
              }))
            }
            fullWidth
          >
            {CHANNELS.map((channel) => (
              <MenuItem key={channel} value={channel}>
                {t(`staffCheckout.channels.${channel}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("staffCheckout.customerId")}
            value={cartForm.customerId}
            onChange={(event) =>
              setCartForm((current) => ({
                ...current,
                customerId: event.target.value,
              }))
            }
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            sx={{ minHeight: 56 }}
          >
            {t("staffCheckout.createCart")}
          </Button>
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2, maxWidth: 880 }}>
            {t("staffCheckout.cartCreated", {
              cartId: cart.cartId,
              state: cart.state,
            })}
          </Alert>

          {!transaction && (
            <Box
              component="form"
              onSubmit={addItem}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "2fr 1fr auto" },
                gap: 2,
                maxWidth: 880,
              }}
            >
              <TextField
                select
                label={t("staffCheckout.product")}
                value={itemForm.skuId}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    skuId: event.target.value,
                  }))
                }
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
                label={t("staffCheckout.quantity")}
                type="number"
                value={itemForm.quantity}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                inputProps={{ min: 0.001, step: "0.001" }}
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                disabled={busy}
                sx={{ minHeight: 56 }}
              >
                {t("staffCheckout.addItem")}
              </Button>
            </Box>
          )}

          {quote && !transaction && (
            <Paper sx={{ mt: 3, p: 3, maxWidth: 880 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t("staffCheckout.quote")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box>
                  <Typography variant="caption">
                    {t("staffCheckout.subtotal")}
                  </Typography>
                  <Typography>
                    {quote.currency} {quote.subtotal}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption">
                    {t("staffCheckout.discount")}
                  </Typography>
                  <Typography>
                    {quote.currency} {quote.discount}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption">
                    {t("staffCheckout.total")}
                  </Typography>
                  <Typography fontWeight={700}>
                    {quote.currency} {quote.total}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption">
                    {t("staffCheckout.expiresAt")}
                  </Typography>
                  <Typography>
                    {new Date(quote.expiresAt).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <TextField
                  select
                  label={t("staffCheckout.paymentMode")}
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value)}
                  size="small"
                  sx={{ minWidth: 220 }}
                >
                  {PAYMENT_MODES.map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {t(`staffCheckout.paymentModes.${mode}`)}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="contained" onClick={checkout} disabled={busy}>
                  {t("staffCheckout.checkout")}
                </Button>
              </Box>
            </Paper>
          )}

          {transaction && (
            <Alert severity="success" sx={{ mt: 3, maxWidth: 880 }}>
              {t("staffCheckout.completed", {
                transactionId: transaction.transactionId,
                state: transaction.state,
                amount: `${transaction.currency} ${transaction.amount}`,
              })}
              {transaction.payment?.redirectUrl && (
                <>
                  {" "}
                  <Link
                    href={transaction.payment.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("staffCheckout.openPayment")}
                  </Link>
                </>
              )}
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default StaffCheckout;
