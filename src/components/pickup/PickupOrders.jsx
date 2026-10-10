import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useStoreLocation } from "../../context/storeLocationContext";
import { listPickupOrders, getPickupOrder } from "../../helpers/pickup_helper";
import PickupOrderDetails from "./PickupOrderDetails";
import PickupSchedule from "../customer/PickupSchedule";
import PickupLifecycleNotice from "../customer/PickupLifecycleNotice";
import { isLegacyPickupOrder, isPickupSummary, matchesPickupQueueView, pickupErrorMessage, validatePickupOrder } from "./pickupUtils";

export default function PickupOrders() {
  const { storeId } = useStoreLocation();
  return <PickupQueue key={storeId} storeId={storeId} />;
}

function PickupQueue({ storeId }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("");
  const [queueView, setQueueView] = useState("ACTIVE");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [queueResult, setQueueResult] = useState(null);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("transactionId") || "");
  const [detailResult, setDetailResult] = useState(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const size = 20;
  const queueKey = JSON.stringify({ storeId, queueView, filter, page, revision });
  const detailKey = JSON.stringify({ storeId, selectedId, revision });
  const queue = queueResult?.key === queueKey ? queueResult.data : null;
  const order = detailResult?.key === detailKey && selectedId ? detailResult.data : null;
  const loading = Boolean(storeId && queueResult?.key !== queueKey);
  const detailLoading = Boolean(storeId && selectedId && detailResult?.key !== detailKey);
  const error = (queueResult?.key === queueKey && queueResult.error) ||
    (selectedId && detailResult?.key === detailKey && detailResult.error);

  useEffect(() => {
    let active = true;
    if (!storeId) return () => { active = false; };
    listPickupOrders({ storeId, queueView, preparationStatus: filter === "OVERDUE" ? "" : filter,
      ...(filter === "OVERDUE" ? { pickupTimingStatus: "OVERDUE" } : {}), page, size })
      .then(({ data }) => {
        if (!Array.isArray(data?.items) || !Number.isInteger(data.total) ||
            data.total < 0 || data.page !== page || data.size !== size ||
            !data.items.every((item) => isPickupSummary(item, storeId) &&
              (filter !== "OVERDUE" || (item.pickupTimingStatus === "OVERDUE" &&
                item.paymentStatus === "SUCCESS")))) {
          throw new Error("pickup.invalidResponse");
        }
        if (!data.items.every((item) => matchesPickupQueueView(item, queueView))) {
          throw new Error("pickup.queueViewUnsupported");
        }
        if (active) setQueueResult({ key: queueKey, data });
      })
      .catch((requestError) => {
        if (active) setQueueResult({ key: queueKey, error: pickupErrorMessage(requestError, t) });
      });
    return () => { active = false; };
  }, [storeId, queueView, filter, page, revision, queueKey, t]);

  useEffect(() => {
    let active = true;
    if (!selectedId || !storeId) return () => { active = false; };
    getPickupOrder(selectedId, storeId)
      .then(({ data }) => {
        validatePickupOrder(data, storeId, selectedId);
        if (active) setDetailResult({ key: detailKey, data });
      })
      .catch((requestError) => {
        if (active) setDetailResult({ key: detailKey, error: pickupErrorMessage(requestError, t) });
      });
    return () => { active = false; };
  }, [storeId, selectedId, revision, detailKey, t]);

  const refresh = () => {
    setRevision((value) => value + 1);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" component="h1">{t("pickup.title")}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t("pickup.subtitle")}</Typography>
      {!storeId ? <Alert severity="warning">{t("pickup.storeRequired")}</Alert> : (
        <>
          <Box role="group" aria-label={t("pickup.queueView")} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {["ACTIVE", "RECONCILIATION"].map((view) => (
              <Button key={view} variant={queueView === view ? "contained" : "outlined"}
                aria-pressed={queueView === view} disabled={mutationBusy}
                sx={{ minHeight: 44 }}
                onClick={() => {
                  setQueueView(view);
                  setFilter("");
                  setPage(0);
                  setSelectedId("");
                  setSearchParams({}, { replace: true });
                }}>{t(view === "ACTIVE" ? "pickup.activePickup" : "pickup.reconciliation")}</Button>
            ))}
          </Box>
          {queueView === "RECONCILIATION" && (
            <Alert severity="warning" sx={{ mb: 2 }}>{t("pickup.reconciliationHint")}</Alert>
          )}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              select size="small" label={t("pickup.filter")} value={filter}
              disabled={mutationBusy || queueView === "RECONCILIATION"}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(0);
                setSelectedId("");
                setSearchParams({}, { replace: true });
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">{t("pickup.activeOrders")}</MenuItem>
              <MenuItem value="OVERDUE">{t("pickup.overdueFilter")}</MenuItem>
              {["NOT_STARTED", "PREPARING", "READY"].map((status) => (
                <MenuItem key={status} value={status}>{t(`pickup.status.${status}`)}</MenuItem>
              ))}
            </TextField>
            <Button onClick={refresh} disabled={loading || detailLoading || mutationBusy}>{t("pickup.refresh")}</Button>
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {loading && <Typography role="status">{t("pickup.loading")}</Typography>}
          {queue?.items.length === 0 && <Typography>{t("pickup.empty")}</Typography>}
          <Box sx={{ display: "grid", gap: 2 }}>
            {queue?.items.map((item) => (
              <Card key={item.transactionId} variant="outlined">
                <CardContent>
                  <Typography fontWeight={700}>{item.transactionId}</Typography>
                  <PickupSchedule order={item} />
                  <PickupLifecycleNotice order={item} />
                  <Typography>{t("pickup.transactionState")}: {item.state}</Typography>
                  {queueView === "ACTIVE" && <Typography>{t(`pickup.status.${item.preparationStatus}`)}</Typography>}
                  <Typography>{t("pickup.payment")}: {item.paymentStatus}</Typography>
                  {isLegacyPickupOrder(item) && (
                    <Alert severity="warning" sx={{ my: 1 }}>{t("pickup.legacyReadOnly")}</Alert>
                  )}
                  {!isLegacyPickupOrder(item) && queueView === "RECONCILIATION" &&
                    item.state !== "EXPIRED" && (
                      <Alert severity="warning" sx={{ my: 1 }}>
                        {t("pickup.reconciliationReason.MISSING_PICKUP_SCHEDULE")}
                      </Alert>
                    )}
                  {queueView === "ACTIVE" && item.paymentMode === "PAY_AT_COUNTER" && !isLegacyPickupOrder(item) && (
                    <Typography>{t(item.arrivalStatus === "ARRIVED" ? "pickup.arrived" : "pickup.awaitingArrival")}</Typography>
                  )}
                  <Typography>{item.currency} {item.amount}</Typography>
                  <Typography>{new Date(item.createdAt).toLocaleString()}</Typography>
                  <Button onClick={() => {
                    setSearchParams({ transactionId: item.transactionId }, { replace: true });
                    setDetailResult(null);
                    setSelectedId(item.transactionId);
                    if (selectedId === item.transactionId) setRevision((value) => value + 1);
                  }} disabled={detailLoading || mutationBusy}>
                    {t("pickup.openOrder", { transactionId: item.transactionId })}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
          {queue && (
            <Stack direction="row" spacing={2} sx={{ my: 2 }}>
              <Button disabled={page === 0 || loading || mutationBusy} onClick={() => setPage(page - 1)}>{t("pickup.previous")}</Button>
              <Typography sx={{ alignSelf: "center" }}>{t("pickup.page", { page: page + 1, total: queue.total })}</Typography>
              <Button disabled={(page + 1) * size >= queue.total || loading || mutationBusy} onClick={() => setPage(page + 1)}>{t("pickup.next")}</Button>
            </Stack>
          )}
          {detailLoading && <Typography role="status">{t("pickup.loadingDetails")}</Typography>}
          {order && (
            <PickupOrderDetails
              key={`${order.transactionId}-${revision}`}
              order={order} onChanged={refresh}
              onBusyChange={setMutationBusy}
              onClose={() => {
                setSelectedId("");
                setSearchParams({}, { replace: true });
              }}
            />
          )}
        </>
      )}
    </Box>
  );
}

PickupQueue.propTypes = { storeId: PropTypes.string.isRequired };
