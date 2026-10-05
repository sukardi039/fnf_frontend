import React, { useState } from "react";
import PropTypes from "prop-types";
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
import { HeaderBar } from "../common";
import { request } from "../../helpers/axios_helper";
import { useStoreLocation } from "../../context/storeLocationContext";
import CheckoutCartItems from "./CheckoutCartItems";
import ProductCatalog from "./ProductCatalog";

const CHANNELS = ["STORE_SELF_SELECT", "STAFF_ASSISTED", "MOBILE_ORDER"];
const PAYMENT_MODES = ["E_PAYMENT", "CASH", "PAY_AT_COUNTER"];

const StaffCheckout = ({ pdaMode = false }) => {
  const { t } = useTranslation();
  const { storeId } = useStoreLocation();
  const [channel, setChannel] = useState("STAFF_ASSISTED");
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState(null);
  const [addedItems, setAddedItems] = useState(0);
  const [quote, setQuote] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addItem = (item) => {
    setItems((current) => {
      const existing = current.find((entry) => entry.skuId === item.skuId);
      if (existing) {
        return current.map((entry) =>
          entry.skuId === item.skuId
            ? { ...entry, quantity: Number(entry.quantity) + item.quantity }
            : entry,
        );
      }
      return [...current, item];
    });
    setError("");
  };

  const updateQuantity = (skuId, quantity) => {
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) {
      setItems((current) => current.filter((item) => item.skuId !== skuId));
    } else {
      setItems((current) =>
        current.map((item) =>
          item.skuId === skuId ? { ...item, quantity: value } : item,
        ),
      );
    }
  };

  const removeItem = (skuId) => {
    setItems((current) => current.filter((item) => item.skuId !== skuId));
  };

  const getQuote = async () => {
    if (items.length === 0) {
      setError(t("staffCheckout.itemRequired"));
      return;
    }
    if (!storeId) {
      setError(t("staffCheckout.storeRequired"));
      return;
    }
    setBusy(true);
    setError("");
    setTransaction(null);
    try {
      let activeCart = cart;
      if (!activeCart) {
        const response = await request(
          "POST",
          "/api/carts",
          {
            storeId,
            channel: pdaMode ? "STAFF_ASSISTED" : channel,
            customerId: customerId.trim() || null,
          },
          { skipAuthRedirect: true, skipBackendErrorDialog: true },
        );
        activeCart = response.data;
        if (!activeCart?.cartId) {
          throw new Error(t("staffCheckout.createFailed"));
        }
        setCart(activeCart);
      }

      let latestQuote = quote;
      for (let index = addedItems; index < items.length; index += 1) {
        const response = await request(
          "POST",
          `/api/carts/${activeCart.cartId}/items`,
          { skuId: items[index].skuId, quantity: Number(items[index].quantity) },
          {
            headers: { "Idempotency-Key": crypto.randomUUID() },
            skipAuthRedirect: true,
            skipBackendErrorDialog: true,
          },
        );
        latestQuote = response.data;
        setAddedItems(index + 1);
      }
      if (!latestQuote?.quoteId) {
        throw new Error(t("staffCheckout.noQuote"));
      }
      setQuote(latestQuote);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t("staffCheckout.createFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (!cart?.cartId || !quote?.quoteId) return;
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
          channel: pdaMode ? "STAFF_ASSISTED" : channel,
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

  const startNewOrder = () => {
    setItems([]);
    setCart(null);
    setAddedItems(0);
    setQuote(null);
    setTransaction(null);
    setCustomerId("");
    setPaymentMode("CASH");
    setError("");
  };

  const locked = Boolean(cart);

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
      {transaction ? (
        <Paper sx={{ p: 3, maxWidth: 880 }}>
          <Alert severity="success">
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
          <Button onClick={startNewOrder} sx={{ mt: 2 }}>
            {t("staffCheckout.newOrder")}
          </Button>
        </Paper>
      ) : (
        <>
          <Paper sx={{ p: 2, mb: 3, maxWidth: 880 }}>
            {pdaMode ? (
              <Alert severity="info">{t("pda.checkout.staffAssisted")}</Alert>
            ) : (
              <TextField
                select
                label={t("staffCheckout.channel")}
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                disabled={locked}
                fullWidth
                sx={{ mb: 2 }}
              >
                {CHANNELS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {t(`staffCheckout.channels.${option}`)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label={t("staffCheckout.customerId")}
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              disabled={locked}
              fullWidth
              sx={{ mt: pdaMode ? 2 : 0 }}
            />
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("customer.menu.browse")}
            </Typography>
            <ProductCatalog onAddToCart={addItem} disabled={locked} />
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("customer.menu.cart")}
            </Typography>
            <CheckoutCartItems
              items={items}
              onRemove={removeItem}
              onUpdateQuantity={updateQuantity}
              disabled={locked || busy}
              onSubmit={getQuote}
              submitLabel={
                quote
                  ? t("staffCheckout.quoteReady")
                  : cart
                    ? t("staffCheckout.retryQuote")
                    : t("staffCheckout.getQuote")
              }
              submitDisabled={Boolean(quote)}
            />
          </Paper>

          {quote && (
            <Paper sx={{ p: 3, maxWidth: 880 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t("staffCheckout.quote")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr 1fr",
                    md: "repeat(4, 1fr)",
                  },
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box>
                  <Typography variant="caption">
                    {t("staffCheckout.subtotal")}
                  </Typography>
                  <Typography>{quote.currency} {quote.subtotal}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">
                    {t("staffCheckout.discount")}
                  </Typography>
                  <Typography>{quote.currency} {quote.discount}</Typography>
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
        </>
      )}
    </Box>
  );
};

StaffCheckout.propTypes = {
  pdaMode: PropTypes.bool,
};

export default StaffCheckout;
