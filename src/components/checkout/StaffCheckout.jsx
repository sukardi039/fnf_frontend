import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link as RouterLink } from "react-router-dom";
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

const CHANNELS = ["STORE_SELF_SELECT", "STAFF_ASSISTED"];
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
  const [confirmationNote, setConfirmationNote] = useState("");
  const cashCommand = useRef(null);
  const submitting = useRef(false);
  const checkoutCommand = useRef(null);

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
    if (!cart?.cartId || !quote?.quoteId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        cartId: cart.cartId,
        quoteId: quote.quoteId,
        paymentMode,
        channel: pdaMode ? "STAFF_ASSISTED" : channel,
      };
      const signature = JSON.stringify(payload);
      if (checkoutCommand.current?.signature !== signature) {
        checkoutCommand.current = { signature, key: crypto.randomUUID() };
      }
      const response = await request(
        "POST",
        "/api/checkout",
        payload,
        {
          headers: { "Idempotency-Key": checkoutCommand.current.key },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      if (!response.data?.transactionId) {
        throw new Error(t("staffCheckout.checkoutNoTransaction"));
      }
      setTransaction({ ...response.data, paymentMode });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          t("staffCheckout.checkoutFailed"),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const confirmCash = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const note = confirmationNote.trim();
    if (!note || note.length > 500) {
      setError(t("staffCheckout.cashNoteRequired"));
      return;
    }
    if (!transaction || transaction.state !== "CASH_PENDING_CONFIRMATION" ||
        !["CASH", "PAY_AT_COUNTER"].includes(transaction.paymentMode)) {
      setError(t("staffCheckout.cashNotPending"));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify({ transactionId: transaction.transactionId, note });
    if (cashCommand.current?.signature !== signature) {
      cashCommand.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const { data } = await request(
        "POST",
        `/api/transactions/${encodeURIComponent(transaction.transactionId)}/confirm-cash`,
        { confirmationNote: note },
        {
          headers: { "Idempotency-Key": cashCommand.current.key },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      if (data?.transactionId !== transaction.transactionId ||
          data.state !== "READY_FOR_HANDOVER" || data.paymentStatus !== "SUCCESS" ||
          typeof data.confirmedBy !== "string" || !data.confirmedBy.trim() ||
          !Number.isFinite(Date.parse(data.confirmedAt))) {
        throw new Error(t("staffCheckout.cashInvalidResponse"));
      }
      setTransaction((current) => ({ ...current, ...data }));
    } catch (requestError) {
      setError(requestError?.response?.data?.message ||
        requestError?.message || t("staffCheckout.cashConfirmFailed"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const startNewOrder = () => {
    if (submitting.current || transaction?.state === "CASH_PENDING_CONFIRMATION") return;
    setItems([]);
    setCart(null);
    setAddedItems(0);
    setQuote(null);
    setTransaction(null);
    setCustomerId("");
    setPaymentMode("CASH");
    setError("");
    setConfirmationNote("");
    cashCommand.current = null;
    checkoutCommand.current = null;
  };

  const locked = Boolean(cart);
  const cashPending = transaction?.state === "CASH_PENDING_CONFIRMATION";
  const paid = ["PAYMENT_SUCCESS", "READY_FOR_HANDOVER", "HANDED_OVER"].includes(transaction?.state);

  return (
    <Box>
      <HeaderBar
        title={t("staffCheckout.title")}
        subtitle={t("staffCheckout.subtitle")}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        {t("pickup.manageExisting")}{" "}
        <Link component={RouterLink} to={pdaMode ? "/pda/pickup" : "/checkout/pickup"}>
          {t("pickup.title")}
        </Link>
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {transaction ? (
        <Paper sx={{ p: 3, maxWidth: 880 }}>
          <Alert severity={paid ? "success" : "info"}>
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
          {cashPending && (
            <Box component="form" onSubmit={confirmCash} sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>{t("staffCheckout.cashPending")}</Alert>
              <TextField
                label={t("staffCheckout.cashNote")} value={confirmationNote}
                onChange={(event) => setConfirmationNote(event.target.value)}
                inputProps={{ maxLength: 500 }} disabled={busy}
                required fullWidth multiline minRows={2}
                helperText={t("staffCheckout.cashNoteHint")}
              />
              <Button
                type="submit" variant="contained" sx={{ mt: 2 }}
                disabled={busy || !confirmationNote.trim()}
              >
                {t(busy ? "staffCheckout.cashConfirming" : "staffCheckout.confirmCash")}
              </Button>
            </Box>
          )}
          {transaction.paymentStatus === "SUCCESS" && transaction.confirmedAt && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {t("staffCheckout.cashConfirmed", {
                confirmedBy: transaction.confirmedBy,
                confirmedAt: new Date(transaction.confirmedAt).toLocaleString(),
              })}
            </Alert>
          )}
          <Button onClick={startNewOrder} disabled={busy || cashPending} sx={{ mt: 2 }}>
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
            <ProductCatalog
              onAddToCart={addItem}
              disabled={locked}
              storeId={storeId}
            />
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
                  disabled={busy}
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
                  {t(busy ? "staffCheckout.checkingOut" : "staffCheckout.checkout")}
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
