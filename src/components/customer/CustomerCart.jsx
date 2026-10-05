import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { LoadingState } from "../common";
import CheckoutCartItems from "../checkout/CheckoutCartItems";
import { useStoreLocation } from "../../context/storeLocationContext";
import {
  createCustomerCart,
  addCustomerCartItem,
  checkoutCustomerCart,
} from "../../helpers/customer_cart_helper";

const CHANNELS = ["MOBILE_ORDER", "STORE_SELF_SELECT", "STAFF_ASSISTED"];
const PAYMENT_MODES = ["E_PAYMENT", "CASH", "PAY_AT_COUNTER"];

export default function CustomerCart({
  items,
  onClear,
  onRemove,
  onUpdateQuantity,
}) {
  const { t } = useTranslation();
  const { storeId } = useStoreLocation();
  const [channel, setChannel] = useState("MOBILE_ORDER");
  const [paymentMode, setPaymentMode] = useState("E_PAYMENT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(null);

  const handleCheckout = async () => {
    if (!storeId.trim() || items.length === 0) return;
    setLoading(true);
    setError("");
    setTransaction(null);
    try {
      const cartResponse = await createCustomerCart({
        storeId: storeId.trim(),
        channel,
        customerId: null,
      });
      const cart = cartResponse.data;
      let quote = null;
      for (const item of items) {
        const itemResponse = await addCustomerCartItem(cart.cartId, {
          skuId: item.skuId,
          quantity: Number(item.quantity),
        });
        quote = itemResponse.data;
      }
      if (!quote) {
        setError(t("customer.cart.noQuote"));
        setLoading(false);
        return;
      }
      const checkoutResponse = await checkoutCustomerCart({
        cartId: cart.cartId,
        quoteId: quote.quoteId,
        paymentMode,
        channel,
      });
      setTransaction(checkoutResponse.data);
      onClear?.();
    } catch (err) {
      setError(
        err?.response?.data?.message || t("customer.cart.checkoutFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message={t("customer.cart.processing")} />;
  }

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {transaction && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("customer.cart.completed", {
            transactionId: transaction.transactionId,
            amount: `${transaction.currency} ${transaction.amount}`,
          })}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t("customer.cart.delivery")}
          </Typography>
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField
              select
              label={t("customer.cart.channel")}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              size="small"
              fullWidth
            >
              {CHANNELS.map((c) => (
                <MenuItem key={c} value={c}>
                  {t(`customer.cart.channels.${c}`, c)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t("customer.cart.paymentMode")}
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              size="small"
              fullWidth
            >
              {PAYMENT_MODES.map((m) => (
                <MenuItem key={m} value={m}>
                  {t(`customer.cart.paymentModes.${m}`, m)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </CardContent>
      </Card>

      <CheckoutCartItems
        items={items}
        onRemove={onRemove}
        onUpdateQuantity={onUpdateQuantity}
        onSubmit={handleCheckout}
        submitLabel={t("customer.cart.checkout")}
        submitDisabled={!storeId}
      />
    </Box>
  );
}

CustomerCart.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      skuId: PropTypes.string.isRequired,
      productName: PropTypes.string.isRequired,
      uom: PropTypes.string.isRequired,
      quantity: PropTypes.number.isRequired,
    }),
  ),
  onClear: PropTypes.func,
  onRemove: PropTypes.func,
  onUpdateQuantity: PropTypes.func,
};

CustomerCart.defaultProps = {
  items: [],
  onClear: null,
  onRemove: null,
  onUpdateQuantity: null,
};
