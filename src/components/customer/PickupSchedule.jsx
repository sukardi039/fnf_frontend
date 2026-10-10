import React from "react";
import PropTypes from "prop-types";
import { Alert, Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { formatPickupSlotWithDate, formatPickupTime } from "../../helpers/pickup_time_helper";

export default function PickupSchedule({ order, compact = false }) {
  const { t } = useTranslation();
  if (!order.pickupSlotStart && !order.pickupSlotEnd && !order.pickupExpiresAt) return null;
  if (!order.pickupSlotStart || !order.pickupSlotEnd || !order.pickupExpiresAt ||
      !order.pickupTimezone ||
      [order.pickupSlotStart, order.pickupSlotEnd, order.pickupExpiresAt]
        .some((value) => !Number.isFinite(Date.parse(value))) ||
      Date.parse(order.pickupSlotEnd) - Date.parse(order.pickupSlotStart) !== 30 * 60 * 1000 ||
      Date.parse(order.pickupExpiresAt) - Date.parse(order.pickupSlotStart) !== 60 * 60 * 1000) {
    return <Alert severity="error">{t("customer.cart.pickupScheduleInvalid")}</Alert>;
  }
  let slot;
  let deadline;
  try {
    slot = formatPickupSlotWithDate(order);
    deadline = formatPickupTime(order.pickupExpiresAt, order.pickupTimezone, order.pickupSlotStart);
  } catch {
    return <Alert severity="error">{t("customer.cart.pickupScheduleInvalid")}</Alert>;
  }
  if (compact) {
    return (
      <Box sx={{ bgcolor: "action.hover", borderRadius: "12px", p: 1.5 }}>
        <Typography variant="body2" fontWeight={600}>
          {t("customer.orders.pickupSlot", { slot })}
        </Typography>
        <Typography variant="body2">
          {t(order.paymentStatus === "SUCCESS"
            ? "customer.orders.collectionDue" : "customer.orders.collectBy", { time: deadline })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("customer.orders.storeTimezone", { timezone: order.pickupTimezone })}
        </Typography>
      </Box>
    );
  }
  return (
    <>
      <Typography>{t("customer.cart.pickupScheduled", {
        slot, timezone: order.pickupTimezone,
      })}</Typography>
      <Typography>{t(order.paymentStatus === "SUCCESS"
        ? "pickup.collectionDue" : "customer.cart.pickupDeadline", { time: deadline })}</Typography>
    </>
  );
}

PickupSchedule.propTypes = {
  compact: PropTypes.bool,
  order: PropTypes.shape({
    pickupSlotStart: PropTypes.string,
    pickupSlotEnd: PropTypes.string,
    pickupExpiresAt: PropTypes.string,
    pickupTimezone: PropTypes.string,
    paymentStatus: PropTypes.string,
  }).isRequired,
};
