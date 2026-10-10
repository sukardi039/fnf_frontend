import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { reconcilePickupOrder } from "../../helpers/pickup_helper";
import { pickupCommandKey } from "../../helpers/pickup_command_helper";
import { hasValidReconciliation } from "../../helpers/pickup_reconciliation_helper";
import { isPickupBlocked } from "../../helpers/pickup_lifecycle_helper";
import { hasValidPickupSchedule, needsPickupReconciliation, pickupErrorMessage, validatePickupOrder } from "./pickupUtils";

export default function PickupReconciliation({ order, onChanged, onBusyChange }) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  if (!hasValidReconciliation(order)) {
    return <Alert severity="error">{t("pickup.invalidResponse")}</Alert>;
  }
  const review = order.reconciliation;
  const allowed = review?.allowedOutcomes || [];
  const latest = review?.latestReview;
  const required = needsPickupReconciliation(order) || review?.required;
  if (!required && !latest) return null;
  const canSubmit = required && allowed.includes(outcome) &&
    note.trim().length > 0 && note.length <= 500 &&
    (outcome === "RECORD_UNRESOLVED" || confirmed);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting.current || needsRefresh) return;
    submitting.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    const payload = { outcome, note: note.trim() };
    try {
      const key = await pickupCommandKey(order.storeId, order.transactionId, "reconciliation", payload);
      const { data } = await reconcilePickupOrder(order.transactionId, order.storeId, payload, key);
      validatePickupOrder(data, order.storeId, order.transactionId);
      const result = data.reconciliation;
      if (!result?.latestReview || result.latestReview.outcome !== outcome ||
          result.latestReview.note !== payload.note ||
          (outcome === "CLOSE_UNPAID" && (data.state !== "CANCELLED" ||
            !["PENDING", "FAILED"].includes(data.paymentStatus) || data.cashReceipt ||
            !["NONE", null, undefined].includes(data.paymentResolutionStatus) || result.required)) ||
          (outcome === "RESTORE_PAID" && (data.paymentStatus !== "SUCCESS" ||
            !["PAYMENT_SUCCESS", "READY_FOR_HANDOVER"].includes(data.state) ||
            !hasValidPickupSchedule(data) || needsPickupReconciliation(data) ||
            isPickupBlocked(data) || result.required)) ||
          (outcome === "RECORD_UNRESOLVED" && !result.required)) {
        throw new Error("pickup.reconciliationInvalidResult");
      }
      if (mounted.current) {
        onBusyChange(false);
        onChanged();
      }
    } catch (requestError) {
      if (mounted.current) {
        const status = requestError?.response?.status;
        setError([404, 405, 501].includes(status)
          ? t("pickup.reconciliationUnavailable") : pickupErrorMessage(requestError, t));
        setNeedsRefresh(true);
      }
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="h6">{t("pickup.reconciliationReview")}</Typography>
      {latest && <Alert severity="info" sx={{ my: 1 }}>
        <Typography>{t("pickup.reconciliationRecorded", {
          outcome: t(`pickup.reconciliationOutcome.${latest.outcome}`),
          actor: latest.reviewedBy, date: new Date(latest.reviewedAt).toLocaleString(),
        })}</Typography>
        <Typography>{latest.note}</Typography>
        <Typography>{t("pickup.reviewReference", { id: latest.reviewId })}</Typography>
      </Alert>}
      {required && <>
        <Alert severity="warning" sx={{ my: 1 }}>
          {t("pickup.reconciliationInstructions")}
          {review?.reason && <Typography>{t(`pickup.reconciliationReason.${review.reason}`)}</Typography>}
        </Alert>
        {!allowed.length ? <Alert severity="warning">{t("pickup.reconciliationUnavailable")}</Alert> : (
          <Box component="form" onSubmit={submit}>
            <Box component="fieldset" disabled={busy || needsRefresh}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
              <TextField select fullWidth label={t("pickup.reviewOutcome")} value={outcome}
                onChange={(event) => { setOutcome(event.target.value); setConfirmed(false); }}>
                {allowed.map((value) => <MenuItem key={value} value={value}>
                  {t(`pickup.reconciliationOutcome.${value}`)}
                </MenuItem>)}
              </TextField>
              <TextField fullWidth multiline minRows={2} required label={t("pickup.reviewNote")}
                value={note} onChange={(event) => setNote(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 500 } }} sx={{ my: 1 }} />
              {outcome && outcome !== "RECORD_UNRESOLVED" && <FormControlLabel
                control={<Checkbox checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)} />}
                label={t(outcome === "CLOSE_UNPAID" ? "pickup.confirmCloseUnpaid" : "pickup.confirmRestorePaid")} />}
              <Button type="submit" variant="contained" disabled={!canSubmit || busy || needsRefresh}
                sx={{ minHeight: 44 }}>{t("pickup.saveReview")}</Button>
            </Box>
          </Box>
        )}
      </>}
      {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
      {needsRefresh && <Alert severity="warning" sx={{ my: 1 }}>
        {t("pickup.refreshAfterFailure")}
        <Button disabled={busy} onClick={onChanged}>{t("pickup.refresh")}</Button>
      </Alert>}
      {busy && <Typography role="status">{t("pickup.saving")}</Typography>}
    </Box>
  );
}

PickupReconciliation.propTypes = {
  order: PropTypes.object.isRequired,
  onChanged: PropTypes.func.isRequired,
  onBusyChange: PropTypes.func.isRequired,
};
