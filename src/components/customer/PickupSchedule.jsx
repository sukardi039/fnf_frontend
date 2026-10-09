import React from "react";
import PropTypes from "prop-types";
import { Alert, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { formatPickupSlot, formatPickupTime } from "../../helpers/pickup_time_helper";

export default function PickupSchedule({ order }) {
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
    slot = formatPickupSlot(order);
    deadline = formatPickupTime(order.pickupExpiresAt, order.pickupTimezone, order.pickupSlotStart);
  } catch {
    return <Alert severity="error">{t("customer.cart.pickupScheduleInvalid")}</Alert>;
  }
  return (
    <>
      <Typography>{t("customer.cart.pickupScheduled", {
        slot, timezone: order.pickupTimezone,
      })}</Typography>
      <Typography>{t("customer.cart.pickupDeadline", { time: deadline })}</Typography>
    </>
  );
}

PickupSchedule.propTypes = {
  order: PropTypes.shape({
    pickupSlotStart: PropTypes.string,
    pickupSlotEnd: PropTypes.string,
    pickupExpiresAt: PropTypes.string,
    pickupTimezone: PropTypes.string,
  }).isRequired,
};
