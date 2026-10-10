import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  allocatePickupLots, preparePickupOrder, verifyPickupCollection, handoverPickupOrder,
  recordPickupArrival, confirmPickupCash,
} from "../../helpers/pickup_helper";
import { buildPickupAllocations, isLegacyPickupOrder, needsPickupReconciliation, pickupErrorMessage, validatePickupOrder } from "./pickupUtils";
import PickupSchedule from "../customer/PickupSchedule";
import PickupLifecycleNotice from "../customer/PickupLifecycleNotice";
import { isPickupBlocked } from "../../helpers/pickup_lifecycle_helper";
import { pickupCommandKey } from "../../helpers/pickup_command_helper";
import { useCameraScanner } from "../../helpers/camera_scanner_helper";
import PickupReconciliation from "./PickupReconciliation";
import ProductThumbnail from "../common/ProductThumbnail";
import useProductPictures from "../../hooks/useProductPictures";

export default function PickupOrderDetails({ order, onChanged, onClose, onBusyChange }) {
  const { t } = useTranslation();
  const { catalogPictures, pictureError } = useProductPictures(order.items);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(
    order.items.filter((line) => line.lotTracked).map((line) => [
      line.saleLineId,
      line.allocations.length ? line.allocations.map((entry) => ({
        lotId: entry.lotId, quantity: String(entry.quantity),
      })) : [{ lotId: "", quantity: "" }],
    ]),
  ));
  const [qrToken, setQrToken] = useState("");
  const [verification, setVerification] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [arrivalToken, setArrivalToken] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [customerPresent, setCustomerPresent] = useState(false);
  const scanPurpose = useRef("arrival");
  const { openScanner, scannerOverlay, scannerOpen } = useCameraScanner({
    containerId: "pickup-order-camera",
    normalize: false,
    onScan: (token) => {
      if (scanPurpose.current === "arrival") setArrivalToken(token);
      else {
        setQrToken(token);
        setVerification(null);
      }
    },
  });
  const mounted = useRef(true);
  const submitting = useRef(false);
  const pendingCommand = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!verification) return undefined;
    const timer = setTimeout(() => setVerification(null), Math.max(
      0, Date.parse(verification.expiresAt) - Date.now(),
    ));
    return () => clearTimeout(timer);
  }, [verification]);

  const run = async (operation) => {
    if (submitting.current || scannerOpen || needsRefresh ||
        needsPickupReconciliation(order) || isPickupBlocked(order)) return;
    submitting.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await operation();
    } catch (requestError) {
      if (mounted.current) {
        setVerification(null);
        setNeedsRefresh(true);
        setError(pickupErrorMessage(requestError, t));
      }
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  };

  const commit = async (name, payload, execute) => {
    const signature = JSON.stringify({ name, payload });
    if (pendingCommand.current?.signature !== signature) {
      pendingCommand.current = {
        signature, key: await pickupCommandKey(order.storeId, order.transactionId, name, payload),
      };
    }
    const { data } = await execute(pendingCommand.current.key);
    validatePickupOrder(data, order.storeId, order.transactionId);
    if ((name === "handover" && data.state !== "HANDED_OVER") ||
        (name === "prepare" && data.preparationStatus !== payload) ||
        (name === "arrival" && data.arrivalStatus !== "ARRIVED") ||
        (name === "cash" && (data.paymentStatus !== "SUCCESS" ||
          data.preparationStatus !== "NOT_STARTED" || data.arrivalStatus !== "ARRIVED"))) {
      throw new Error("pickup.invalidResponse");
    }
    pendingCommand.current = null;
    if (mounted.current) {
      onBusyChange(false);
      onChanged();
    }
  };

  const mutate = (name, payload, execute) => run(() => commit(name, payload, execute));

  const updateDraft = (lineId, index, field, value) => setDrafts((current) => ({
    ...current,
    [lineId]: current[lineId].map((entry, rowIndex) =>
      rowIndex === index ? { ...entry, [field]: value } : entry),
  }));

  const saveAllocations = () => run(async () => {
    const allocations = buildPickupAllocations(order.items, drafts);
    await commit("allocate", allocations, (key) => allocatePickupLots(
      order.transactionId, order.storeId, allocations, key,
    ));
  });

  const verify = () => run(async () => {
    setVerification(null);
    if (!qrToken.trim()) throw new Error("pickup.tokenRequired");
    const { data } = await verifyPickupCollection(order.transactionId, order.storeId, qrToken.trim());
    if (data?.transactionId !== order.transactionId || data?.storeId !== order.storeId ||
        data?.verified !== true || !Number.isFinite(Date.parse(data.expiresAt)) ||
        Date.parse(data.expiresAt) <= Date.now()) {
      throw new Error("pickup.invalidVerification");
    }
    if (mounted.current) setVerification(data);
  });

  const handover = () => {
    if (!verification || Date.parse(verification.expiresAt) <= Date.now()) {
      setVerification(null);
      setError(t("pickup.verifyFirst"));
      return;
    }
    mutate("handover", qrToken.trim(), (key) =>
      handoverPickupOrder(order.transactionId, order.storeId, qrToken.trim(), key));
  };

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6" component="h2">{t("pickup.orderTitle", { transactionId: order.transactionId })}</Typography>
          <Button onClick={onClose} disabled={busy}>{t("pickup.close")}</Button>
        </Stack>
        <Typography>{t("pickup.payment")}: {order.paymentStatus}</Typography>
        <Typography>{t("pickup.transactionState")}: {order.state}</Typography>
        <PickupSchedule order={order} />
        <PickupLifecycleNotice order={order} />
        <Typography fontWeight={700}>{order.currency} {order.amount}</Typography>
        {order.paymentMode === "E_PAYMENT" && (
          <Alert severity="warning" sx={{ my: 1 }}>{t("customer.cart.onlinePaymentMock")}</Alert>
        )}
        {order.state === "HANDED_OVER" && (
          <Alert severity="success" sx={{ my: 1 }}>{t("pickup.completed")}</Alert>
        )}
        <PickupReconciliation order={order} onChanged={onChanged}
          onBusyChange={(value) => { setBusy(value); onBusyChange(value); }} />
        {!needsPickupReconciliation(order) && !isLegacyPickupOrder(order) &&
          !isPickupBlocked(order) && order.state !== "HANDED_OVER" && (
          <Alert severity="info" sx={{ my: 1 }}>{t(
            ["EXPIRED", "CANCELLED", "REFUNDED"].includes(order.state) ? "pickup.terminalGuidance" :
              order.actions.canRecordArrival ? "pickup.nextArrival" :
                order.actions.canConfirmCash ? "pickup.nextCash" :
                  order.paymentStatus !== "SUCCESS" ? "pickup.nextPayment" :
                    order.preparationStatus === "READY" ? "pickup.nextCollection" :
                      order.preparationStatus === "PREPARING" ? "pickup.nextReady" : "pickup.nextPrepare",
          )}</Alert>
        )}
        <Typography>{t(`pickup.status.${order.preparationStatus}`)}</Typography>
        {isLegacyPickupOrder(order) && (
          <Alert severity="warning" sx={{ my: 2 }}>{t("pickup.legacyReadOnly")}</Alert>
        )}
        {order.paymentMode === "PAY_AT_COUNTER" && !isLegacyPickupOrder(order) && (
          <>
            <Typography>{t("pickup.payAtCollectionHint")}</Typography>
            <Typography>{t(order.arrivalStatus === "ARRIVED" ? "pickup.arrived" : "pickup.awaitingArrival")}</Typography>
          </>
        )}
        {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
        {needsRefresh && (
          <Alert severity="warning" sx={{ my: 2 }}>
            {t("pickup.refreshAfterFailure")}
            <Button disabled={busy} onClick={onChanged}>{t("pickup.refresh")}</Button>
          </Alert>
        )}
        <Box component="fieldset" disabled={busy || needsRefresh ||
          needsPickupReconciliation(order) || isPickupBlocked(order)}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        {order.actions.canRecordArrival && (
          <Box sx={{ my: 2 }}>
            <Button disabled={busy} onClick={() => {
              scanPurpose.current = "arrival";
              openScanner();
            }}>{t("pickup.scanArrival")}</Button>
            <TextField
              label={t("pickup.arrivalToken")} value={arrivalToken} fullWidth multiline
              disabled={busy} inputProps={{ maxLength: 2048 }}
              onChange={(event) => setArrivalToken(event.target.value)}
            />
            <FormControlLabel
              control={<Checkbox checked={customerPresent} disabled={busy}
                onChange={(event) => setCustomerPresent(event.target.checked)} />}
              label={t("pickup.customerPresent")}
            />
            <Button
              sx={{ mt: 1 }} disabled={busy || !arrivalToken.trim() || !customerPresent}
              onClick={() => mutate("arrival", arrivalToken.trim(), (key) =>
                recordPickupArrival(order.transactionId, order.storeId, arrivalToken.trim(), key))}
            >{t("pickup.recordArrival")}</Button>
          </Box>
        )}
        {order.actions.canConfirmCash && (
          <Box component="form" sx={{ my: 2 }} onSubmit={(event) => {
            event.preventDefault();
            if (!cashNote.trim() || cashNote.trim().length > 500) {
              setError(t("staffCheckout.cashNoteRequired"));
              return;
            }
            mutate("cash", cashNote.trim(), (key) =>
              confirmPickupCash(order.transactionId, order.storeId, cashNote.trim(), key));
          }}>
            <Alert severity="warning" sx={{ mb: 1 }}>
              {t("pickup.receiveCash", { amount: `${order.currency} ${order.amount}` })}
            </Alert>
            <TextField
              label={t("staffCheckout.cashNote")} value={cashNote}
              fullWidth multiline required disabled={busy} inputProps={{ maxLength: 500 }}
              onChange={(event) => setCashNote(event.target.value)}
            />
            <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={busy || !cashNote.trim()}>
              {t("staffCheckout.confirmCash")}
            </Button>
          </Box>
        )}
        <Box sx={{ display: "grid", gap: 2, my: 2 }}>
          {pictureError && <Alert severity="warning">{t("customer.cart.picturesFailed")}</Alert>}
          {order.items.map((line) => (
            <Box key={line.saleLineId} sx={{ border: 1, borderColor: "divider", p: 2, borderRadius: 1 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 1, alignItems: "center", mb: 1 }}>
                <ProductThumbnail picture={line.productPicture || catalogPictures[line.skuId]} alt={line.productName} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{line.productName}</Typography>
                  <Typography>{line.skuId}: {line.quantity} {line.uom}</Typography>
                </Box>
              </Box>
              {line.allocations.map((entry) => (
                <Typography key={entry.lotId}>{t("pickup.allocated", {
                  lotId: entry.lotId, quantity: entry.quantity, uom: entry.uom,
                })}</Typography>
              ))}
              {line.lotTracked && order.actions.canAllocateLots && (
                <Box sx={{ mt: 2 }}>
                  {line.availableLots.length === 0 && <Alert severity="warning">{t("pickup.noLots")}</Alert>}
                  {drafts[line.saleLineId].map((row, index) => (
                    <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                      <TextField
                        select label={t("pickup.lot")} value={row.lotId} disabled={busy}
                        onChange={(event) => updateDraft(line.saleLineId, index, "lotId", event.target.value)}
                        size="small" sx={{ minWidth: 200 }}
                      >
                        {line.availableLots.map((lot) => (
                          <MenuItem key={lot.lotId} value={lot.lotId}>
                            {t("pickup.lotOption", {
                              lotId: lot.lotId, quantity: lot.availableQuantity, uom: lot.uom,
                            })}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        type="number" label={t("pickup.quantity")} value={row.quantity}
                        disabled={busy} size="small" inputProps={{ min: 0, step: "any" }}
                        onChange={(event) => updateDraft(line.saleLineId, index, "quantity", event.target.value)}
                      />
                      <Button disabled={busy} onClick={() => setDrafts((current) => ({
                        ...current,
                        [line.saleLineId]: current[line.saleLineId].filter((_, rowIndex) => rowIndex !== index),
                      }))}>{t("pickup.removeLot")}</Button>
                    </Stack>
                  ))}
                  <Button disabled={busy} onClick={() => setDrafts((current) => ({
                    ...current, [line.saleLineId]: [...current[line.saleLineId], { lotId: "", quantity: "" }],
                  }))}>{t("pickup.addLot")}</Button>
                </Box>
              )}
            </Box>
          ))}
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {order.actions.canAllocateLots && order.items.some((line) => line.lotTracked) && (
            <Button disabled={busy} onClick={saveAllocations}>{t("pickup.saveAllocations")}</Button>
          )}
          {order.actions.canStartPreparation && (
            <Button disabled={busy} onClick={() => mutate("prepare", "PREPARING", (key) =>
              preparePickupOrder(order.transactionId, order.storeId, "PREPARING", key),
            )}>{t("pickup.startPreparation")}</Button>
          )}
          {order.actions.canMarkReady && (
            <Button disabled={busy} variant="contained" onClick={() => mutate("prepare", "READY", (key) =>
              preparePickupOrder(order.transactionId, order.storeId, "READY", key),
            )}>{t("pickup.markReady")}</Button>
          )}
        </Stack>
        <Typography color="text.secondary" sx={{ my: 2 }}>{t("pickup.handoverHint")}</Typography>
        {order.actions.canHandover && (
          <Box>
            <Button disabled={busy} onClick={() => {
              scanPurpose.current = "collection";
              openScanner();
            }}>{t("pickup.scanCollection")}</Button>
            <TextField
              label={t("pickup.collectionToken")} value={qrToken} fullWidth multiline
              disabled={busy} inputProps={{ maxLength: 2048 }}
              onChange={(event) => { setQrToken(event.target.value); setVerification(null); }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button disabled={busy || !qrToken.trim()} onClick={verify}>{t("pickup.verify")}</Button>
              <Button variant="contained" color="success" disabled={busy || !verification} onClick={handover}>
                {t("pickup.confirmHandover")}
              </Button>
            </Stack>
            {verification && <Alert severity="success" sx={{ mt: 2 }}>{t("pickup.verified")}</Alert>}
          </Box>
        )}
        </Box>
        {busy && <Typography role="status" sx={{ mt: 1 }}>{t("pickup.saving")}</Typography>}
        {scannerOverlay}
      </CardContent>
    </Card>
  );
}

PickupOrderDetails.propTypes = {
  order: PropTypes.shape({
    transactionId: PropTypes.string.isRequired,
    storeId: PropTypes.string.isRequired,
    state: PropTypes.string.isRequired,
    paymentStatus: PropTypes.string.isRequired,
    preparationStatus: PropTypes.string.isRequired,
    paymentMode: PropTypes.string,
    arrivalStatus: PropTypes.string,
    currency: PropTypes.string.isRequired,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    items: PropTypes.arrayOf(PropTypes.object).isRequired,
    actions: PropTypes.shape({
      canAllocateLots: PropTypes.bool.isRequired,
      canStartPreparation: PropTypes.bool.isRequired,
      canMarkReady: PropTypes.bool.isRequired,
      canHandover: PropTypes.bool.isRequired,
      canRecordArrival: PropTypes.bool,
      canConfirmCash: PropTypes.bool,
    }).isRequired,
  }).isRequired,
  onChanged: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onBusyChange: PropTypes.func.isRequired,
};
