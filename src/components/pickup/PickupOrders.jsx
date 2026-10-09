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
import { isPickupSummary, pickupErrorMessage, validatePickupOrder } from "./pickupUtils";

export default function PickupOrders() {
  const { storeId } = useStoreLocation();
  return <PickupQueue key={storeId} storeId={storeId} />;
}

function PickupQueue({ storeId }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [queueResult, setQueueResult] = useState(null);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("transactionId") || "");
  const [detailResult, setDetailResult] = useState(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const size = 20;
  const queueKey = JSON.stringify({ storeId, filter, page, revision });
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
    listPickupOrders({ storeId, preparationStatus: filter, page, size })
      .then(({ data }) => {
        if (!Array.isArray(data?.items) || !Number.isInteger(data.total) ||
            data.total < 0 || data.page !== page || data.size !== size ||
            !data.items.every((item) => isPickupSummary(item, storeId))) {
          throw new Error("pickup.invalidResponse");
        }
        if (active) setQueueResult({ key: queueKey, data });
      })
      .catch((requestError) => {
        if (active) setQueueResult({ key: queueKey, error: pickupErrorMessage(requestError, t) });
      });
    return () => { active = false; };
  }, [storeId, filter, page, revision, queueKey, t]);

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
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              select size="small" label={t("pickup.filter")} value={filter} disabled={mutationBusy}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(0);
                setSelectedId("");
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">{t("pickup.activeOrders")}</MenuItem>
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
                  <Typography>{t(`pickup.status.${item.preparationStatus}`)}</Typography>
                  <Typography>{t("pickup.payment")}: {item.paymentStatus}</Typography>
                  {item.paymentMode === "PAY_AT_COUNTER" && (
                    <Typography>{t(item.arrivalStatus === "ARRIVED" ? "pickup.arrived" : "pickup.awaitingArrival")}</Typography>
                  )}
                  <Typography>{item.currency} {item.amount}</Typography>
                  <Typography>{new Date(item.createdAt).toLocaleString()}</Typography>
                  <Button onClick={() => {
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
              onClose={() => setSelectedId("")}
            />
          )}
        </>
      )}
    </Box>
  );
}

PickupQueue.propTypes = { storeId: PropTypes.string.isRequired };
