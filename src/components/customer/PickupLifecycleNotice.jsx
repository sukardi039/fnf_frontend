import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import { hasValidPickupLifecycle, isPaidPickupOverdue, isPaymentResolving } from "../../helpers/pickup_lifecycle_helper";

export default function PickupLifecycleNotice({ order }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!hasValidPickupLifecycle(order)) return <Alert severity="error">{t("pickup.invalidResponse")}</Alert>;
  const overdue = isPaidPickupOverdue(order, now);
  const due = Date.parse(order.pickupExpiresAt);
  return (
    <>
      {overdue && <Alert severity="warning">
        {t("pickup.overduePaid")}
        {Number.isFinite(due) && t("pickup.overdueMinutes", {
          minutes: Math.max(0, Math.floor((now - due) / 60_000)),
        })}
      </Alert>}
      {isPaymentResolving(order) && <Alert severity="info">
        {t(order.paymentResolutionStatus === "IN_FLIGHT" ? "pickup.paymentInFlight" : "pickup.paymentChecking")}
        {order.paymentResolutionDeadline && t("pickup.resolutionDeadline", {
          date: new Date(order.paymentResolutionDeadline).toLocaleString(),
        })}
      </Alert>}
      {order.fulfilmentHoldReason && <Alert severity="warning">
        {t(order.fulfilmentHoldReason === "QUALITY_REVIEW" ? "pickup.qualityHold" : "pickup.latePaymentHold")}
      </Alert>}
      {order.state === "EXPIRED" && order.paymentStatus === "SUCCESS" && (
        <Alert severity="error">{t("pickup.paidExpiredReview")}</Alert>
      )}
    </>
  );
}

PickupLifecycleNotice.propTypes = { order: PropTypes.object.isRequired };
