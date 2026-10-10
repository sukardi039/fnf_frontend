import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { LoadingState } from "../common";
import CheckoutCartItems from "../checkout/CheckoutCartItems";
import CollectionToken from "./CollectionToken";
import PickupSchedule from "./PickupSchedule";
import PickupLifecycleNotice from "./PickupLifecycleNotice";
import { canContinuePickupPayment, isPickupBlocked } from "../../helpers/pickup_lifecycle_helper";
import { formatPickupSlotWithDate, getPickupSlots } from "../../helpers/pickup_time_helper";
import { useStoreLocation } from "../../context/storeLocationContext";
import { getCustomerInfo } from "../../helpers/customer_helper";
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt } from "../../helpers/customer_checkout_recovery";
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
  const [recovery] = useState(() => {
    const customerId = getCustomerInfo()?.customerId;
    try {
      return { customerId, attempt: readCheckoutAttempt(customerId), error: "" };
    } catch (recoveryError) {
      return { customerId, attempt: null, error: recoveryError.message };
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => recovery.error
    ? t(recovery.error.startsWith("customer.") ? recovery.error : "customer.cart.recoveryInvalid") : "");
  const [transaction, setTransaction] = useState(null);
  const [paymentMode, setPaymentMode] = useState(recovery.attempt?.paymentMode || "PAY_AT_COUNTER");
  const [attemptStarted, setAttemptStarted] = useState(Boolean(recovery.attempt));
  const attempt = useRef(recovery.attempt);
  const submitting = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [pickupChoice, setPickupChoice] = useState("");
  const [lockedSlot, setLockedSlot] = useState(recovery.attempt?.pickupSlot || null);
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
    if (recovery.error) return;
    if (!storeId.trim() || (!attempt.current && items.length === 0)) {
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
          storeId: storeId.trim(), paymentMode,
          items: items.map(({ skuId, productName, uom, quantity }) => ({ skuId, productName, uom, quantity })),
          createKey: crypto.randomUUID(), checkoutKey: crypto.randomUUID(),
          itemKeys: items.map(() => crypto.randomUUID()), cartId: null, added: 0, quoteId: null,
        };
        setLockedSlot(pickupSlot);
        setAttemptStarted(true);
      }
      const current = attempt.current;
      if (current.storeId !== storeId.trim()) throw new Error(t("customer.cart.storeChanged"));
      saveCheckoutAttempt(recovery.customerId, current);
      if (!current.cartId) {
        const { data } = await createCustomerCart({
          storeId: current.storeId, channel: CHANNEL, customerId: null,
        }, current.createKey);
        if (!data?.cartId) throw new Error(t("customer.cart.checkoutFailed"));
        current.cartId = data.cartId;
        saveCheckoutAttempt(recovery.customerId, current);
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
        saveCheckoutAttempt(recovery.customerId, current);
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
      clearCheckoutAttempt(recovery.customerId);
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
      {recovery.attempt && !transaction && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("customer.cart.recoveredAttempt")}
          <Link component={RouterLink} to="/m/orders" sx={{ ml: 1 }}>{t("collection.viewOrders")}</Link>
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
          <PickupLifecycleNotice order={transaction} />
          {!paid && !paymentFailed && <Typography>{t(transaction.paymentMode === "PAY_AT_COUNTER"
            ? "customer.cart.payAtCollectionInstructions" : "customer.cart.paymentUnconfirmed")}</Typography>}
          {transaction.state === "EXPIRED" && transaction.paymentStatus !== "SUCCESS" &&
            <Typography>{t("customer.orders.expired")}</Typography>}
          {transaction.payment?.redirectUrl && canContinuePickupPayment(transaction) && (
            <Link href={transaction.payment.redirectUrl} target="_blank" rel="noopener noreferrer" sx={{ ml: 1 }}>
              {t("staffCheckout.openPayment")}
            </Link>
          )}
          {transaction?.paymentMode === "PAY_AT_COUNTER" &&
            !isPickupBlocked(transaction) &&
            transaction.state === "CASH_PENDING_CONFIRMATION" && (
              <CollectionToken transactionId={transaction.transactionId} purpose="arrival" />
            )}
        </Alert>
      )}
      {transaction && transaction.channel === "MOBILE_ORDER" &&
        !isPickupBlocked(transaction) &&
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
              <Box role="group" aria-label={t("customer.cart.pickupTime")} sx={{ mt: 2 }}>
                <Typography sx={{ mb: 1 }}>{t("customer.cart.pickupTime")}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {(lockedSlot ? [lockedSlot] : slots).map((slot) => (
                  <Button
                    key={slot.pickupSlotStart}
                    type="button"
                    variant={displayedSlot?.pickupSlotStart === slot.pickupSlotStart ? "contained" : "outlined"}
                    aria-pressed={displayedSlot?.pickupSlotStart === slot.pickupSlotStart}
                    disabled={attemptStarted}
                    onClick={() => setPickupChoice(slot.pickupSlotStart)}
                    sx={{ minHeight: 44 }}
                  >
                    {formatPickupSlotWithDate(slot)}
                  </Button>
                ))}
                </Box>
              </Box>
              <Typography sx={{ mt: 1 }}>{t("customer.cart.pickupRules", { timezone: store?.timezone })}</Typography>
              {displayedSlot && <PickupSchedule order={displayedSlot} />}
              {!attemptStarted && (!slots.length || !selectedSlot) && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t(slots.length ? "customer.cart.pickupSlotUnavailable" : "customer.cart.noPickupSlots")}
                </Alert>
              )}
            </>
          )}
          <Box role="group" aria-label={t("customer.cart.paymentChoice")} sx={{ mt: 2 }}>
            <Typography sx={{ mb: 1 }}>{t("customer.cart.paymentChoice")}</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {[
                { value: "PAY_AT_COUNTER", label: "customer.cart.payAtCollection" },
                { value: "E_PAYMENT", label: "customer.cart.payOnline" },
              ].map((method) => (
                <Button
                  key={method.value}
                  type="button"
                  variant={paymentMode === method.value ? "contained" : "outlined"}
                  aria-pressed={paymentMode === method.value}
                  disabled={attemptStarted}
                  onClick={() => setPaymentMode(method.value)}
                  sx={{ minHeight: 44 }}
                >
                  {t(method.label)}
                </Button>
              ))}
            </Box>
          </Box>
          <Typography sx={{ mt: 1 }}>{t(paymentMode === "PAY_AT_COUNTER"
            ? "customer.cart.payAtCollectionInstructions" : "customer.cart.pickupInstructions")}</Typography>
          {paymentMode === "E_PAYMENT" && (
            <Alert severity="warning" sx={{ mt: 1 }}>{t("customer.cart.onlinePaymentMock")}</Alert>
          )}
        </CardContent>
      </Card>

      <CheckoutCartItems
        items={recovery.attempt?.items || items}
        onRemove={attemptStarted ? undefined : onRemove}
        onUpdateQuantity={attemptStarted ? undefined : onUpdateQuantity}
        editingDisabled={attemptStarted}
        onSubmit={handleCheckout}
        submitLabel={t("customer.cart.checkout")}
        submitDisabled={!storeId || Boolean(transaction) || Boolean(recovery.error) ||
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
