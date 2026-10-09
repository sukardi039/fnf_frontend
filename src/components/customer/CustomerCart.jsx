import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Link,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { LoadingState } from "../common";
import CheckoutCartItems from "../checkout/CheckoutCartItems";
import CollectionToken from "./CollectionToken";
import PickupSchedule from "./PickupSchedule";
import { formatPickupSlot, getPickupSlots } from "../../helpers/pickup_time_helper";
import { useStoreLocation } from "../../context/storeLocationContext";
import {
  createCustomerCart,
  addCustomerCartItem,
  checkoutCustomerCart,
} from "../../helpers/customer_cart_helper";

const CHANNEL = "MOBILE_ORDER";

export default function CustomerCart({
  items,
  onClear,
  onRemove,
  onUpdateQuantity,
}) {
  const { t } = useTranslation();
  const { storeId, store } = useStoreLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [paymentMode, setPaymentMode] = useState("PAY_AT_COUNTER");
  const [attemptStarted, setAttemptStarted] = useState(false);
  const attempt = useRef(null);
  const submitting = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [pickupChoice, setPickupChoice] = useState("");
  const [lockedSlot, setLockedSlot] = useState(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  let slots = [];
  let scheduleError = false;
  try {
    slots = getPickupSlots(now, store?.timezone, store?.businessHours);
  } catch {
    scheduleError = true;
  }
  const selectedSlot = slots.find((slot) => slot.pickupSlotStart === pickupChoice) ||
    (!pickupChoice ? slots[0] : null);
  const displayedSlot = lockedSlot || selectedSlot;

  const handleCheckout = async () => {
    if (submitting.current || transaction) return;
    if (!storeId.trim() || items.length === 0) {
      setError(t("customer.cart.checkoutRequired"));
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError("");
    setTransaction(null);
    try {
      if (!attempt.current) {
        const pickupSlot = getPickupSlots(new Date(), store?.timezone, store?.businessHours)
          .find((slot) => slot.pickupSlotStart === selectedSlot?.pickupSlotStart);
        if (!pickupSlot) throw new Error(t("customer.cart.pickupSlotUnavailable"));
        attempt.current = {
          pickupSlot,
          storeId: storeId.trim(), paymentMode, items: items.map((item) => ({ ...item })),
          createKey: crypto.randomUUID(), checkoutKey: crypto.randomUUID(),
          itemKeys: items.map(() => crypto.randomUUID()), cartId: null, added: 0, quoteId: null,
        };
        setLockedSlot(pickupSlot);
        setAttemptStarted(true);
      }
      const current = attempt.current;
      if (current.storeId !== storeId.trim()) throw new Error(t("customer.cart.storeChanged"));
      if (!current.cartId) {
        const { data } = await createCustomerCart({
          storeId: current.storeId, channel: CHANNEL, customerId: null,
        }, current.createKey);
        if (!data?.cartId) throw new Error(t("customer.cart.checkoutFailed"));
        current.cartId = data.cartId;
      }
      while (current.added < current.items.length) {
        const item = current.items[current.added];
        const itemResponse = await addCustomerCartItem(current.cartId, {
          skuId: item.skuId,
          quantity: Number(item.quantity),
        }, current.itemKeys[current.added]);
        if (!itemResponse.data?.quoteId) throw new Error(t("customer.cart.noQuote"));
        current.quoteId = itemResponse.data.quoteId;
        current.added += 1;
      }
      const checkoutResponse = await checkoutCustomerCart({
        cartId: current.cartId,
        quoteId: current.quoteId,
        paymentMode: current.paymentMode,
        channel: CHANNEL,
        pickupSlotStart: current.pickupSlot.pickupSlotStart,
      }, current.checkoutKey);
      if (!checkoutResponse.data?.transactionId) {
        throw new Error(t("customer.cart.checkoutNoTransaction"));
      }
      setTransaction({ ...checkoutResponse.data, channel: CHANNEL, paymentMode: current.paymentMode });
      if (Date.parse(checkoutResponse.data.pickupSlotStart) !== Date.parse(current.pickupSlot.pickupSlotStart) ||
          Date.parse(checkoutResponse.data.pickupSlotEnd) !== Date.parse(current.pickupSlot.pickupSlotEnd) ||
          Date.parse(checkoutResponse.data.pickupExpiresAt) !== Date.parse(current.pickupSlot.pickupExpiresAt) ||
          checkoutResponse.data.pickupTimezone !== current.pickupSlot.pickupTimezone) {
        setError(t("customer.cart.pickupScheduleUnconfirmed"));
      }
      onClear?.();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || t("customer.cart.checkoutFailed"),
      );
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  if (loading) {
    return <LoadingState message={t("customer.cart.processing")} />;
  }

  const paid = transaction &&
    ["PAYMENT_SUCCESS", "READY_FOR_HANDOVER", "HANDED_OVER"].includes(transaction.state);
  const paymentFailed = transaction &&
    ["PAYMENT_FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(transaction.state);

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {transaction && (
        <Alert severity={paid ? "success" : paymentFailed ? "warning" : "info"} sx={{ mb: 2 }}>
          {t("customer.cart.orderSubmitted", {
            transactionId: transaction.transactionId,
            amount: `${transaction.currency} ${transaction.amount}`,
            state: transaction.state,
          })}
          <PickupSchedule order={transaction} />
          {!paid && !paymentFailed && <Typography>{t(transaction.paymentMode === "PAY_AT_COUNTER"
            ? "customer.cart.payAtCollectionInstructions" : "customer.cart.paymentUnconfirmed")}</Typography>}
          {transaction.state === "EXPIRED" && <Typography>{t("customer.orders.expired")}</Typography>}
          {transaction.payment?.redirectUrl && (
            <Link href={transaction.payment.redirectUrl} target="_blank" rel="noopener noreferrer" sx={{ ml: 1 }}>
              {t("staffCheckout.openPayment")}
            </Link>
          )}
          {transaction?.paymentMode === "PAY_AT_COUNTER" &&
            transaction.state === "CASH_PENDING_CONFIRMATION" && (
              <CollectionToken transactionId={transaction.transactionId} purpose="arrival" />
            )}
        </Alert>
      )}
      {transaction && transaction.channel === "MOBILE_ORDER" &&
        transaction.preparationStatus === "READY" &&
        ["PAYMENT_SUCCESS", "READY_FOR_HANDOVER"].includes(transaction.state) && (
          <CollectionToken key={transaction.transactionId} transactionId={transaction.transactionId} />
        )}
      {transaction && (
        <Link component={RouterLink} to="/m/orders" sx={{ display: "inline-block", mb: 2 }}>
          {t("collection.viewOrders")}
        </Link>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t("customer.cart.pickupTitle")}
          </Typography>
          <Typography fontWeight={700}>
            {t("customer.cart.pickupStore", { store: store?.storeName || storeId })}
          </Typography>
          {scheduleError ? (
            <Alert severity="error" sx={{ mt: 2 }}>{t("customer.cart.pickupHoursRequired")}</Alert>
          ) : (
            <>
              <TextField
                select fullWidth size="small" sx={{ mt: 2 }}
                label={t("customer.cart.pickupTime")} value={displayedSlot?.pickupSlotStart || ""}
                disabled={attemptStarted || slots.length === 0}
                onChange={(event) => setPickupChoice(event.target.value)}
              >
                {(lockedSlot ? [lockedSlot] : slots).map((slot) => (
                  <MenuItem key={slot.pickupSlotStart} value={slot.pickupSlotStart}>
                    {formatPickupSlot(slot)}
                  </MenuItem>
                ))}
              </TextField>
              <Typography sx={{ mt: 1 }}>{t("customer.cart.pickupRules", { timezone: store?.timezone })}</Typography>
              {displayedSlot && <PickupSchedule order={displayedSlot} />}
              {!attemptStarted && (!slots.length || !selectedSlot) && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t(slots.length ? "customer.cart.pickupSlotUnavailable" : "customer.cart.noPickupSlots")}
                </Alert>
              )}
            </>
          )}
          <TextField
            select fullWidth size="small" sx={{ mt: 2 }}
            label={t("customer.cart.paymentChoice")} value={paymentMode}
            disabled={attemptStarted}
            onChange={(event) => setPaymentMode(event.target.value)}
          >
            <MenuItem value="PAY_AT_COUNTER">{t("customer.cart.payAtCollection")}</MenuItem>
            <MenuItem value="E_PAYMENT">{t("customer.cart.payOnline")}</MenuItem>
          </TextField>
          <Typography sx={{ mt: 1 }}>{t(paymentMode === "PAY_AT_COUNTER"
            ? "customer.cart.payAtCollectionInstructions" : "customer.cart.pickupInstructions")}</Typography>
          {paymentMode === "E_PAYMENT" && (
            <Alert severity="warning" sx={{ mt: 1 }}>{t("customer.cart.onlinePaymentMock")}</Alert>
          )}
        </CardContent>
      </Card>

      <CheckoutCartItems
        items={items}
        onRemove={attemptStarted ? undefined : onRemove}
        onUpdateQuantity={attemptStarted ? undefined : onUpdateQuantity}
        editingDisabled={attemptStarted}
        onSubmit={handleCheckout}
        submitLabel={t("customer.cart.checkout")}
        submitDisabled={!storeId || Boolean(transaction) ||
          (!attemptStarted && (scheduleError || !selectedSlot))}
      />
      {attemptStarted && !transaction && (
        <Alert severity="info" sx={{ mt: 2 }}>{t("customer.cart.retryExisting")}</Alert>
      )}
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
