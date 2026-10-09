import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LoadingState, EmptyState } from "../common";
import { listCustomerTransactions } from "../../helpers/customer_cart_helper";
import { getCustomerInfo } from "../../helpers/customer_helper";
import CollectionToken from "./CollectionToken";
import PickupSchedule from "./PickupSchedule";

const STATUS_COLORS = {
  CART_CREATED: "default",
  CHECKOUT_PENDING: "default",
  PAYMENT_PENDING: "warning",
  CASH_PENDING_CONFIRMATION: "warning",
  PAYMENT_SUCCESS: "success",
  PAYMENT_FAILED: "error",
  READY_FOR_HANDOVER: "info",
  HANDED_OVER: "success",
  CANCELLED: "error",
  REFUNDED: "error",
  EXPIRED: "error",
};

export default function CustomerOrders() {
  const customer = useMemo(() => getCustomerInfo(), []);
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await listCustomerTransactions({
          customerId: customer?.customerId,
          page,
          size: 20,
        });
        if (!active) return;
        if (!Array.isArray(response.data?.items) || !Number.isInteger(response.data.total)) {
          throw new Error(t("customer.orders.loadFailed"));
        }
        setItems(response.data.items);
        setTotal(response.data.total);
        window.dispatchEvent(new Event("customer:orders:refresh"));
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message || t("customer.orders.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t, customer?.customerId, page, revision]);

  if (loading) {
    return <LoadingState message={t("customer.orders.loading")} />;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button onClick={() => setRevision((value) => value + 1)}>{t("pickup.refresh")}</Button>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!error && items.length === 0 ? (
        <EmptyState
          title={t("customer.orders.noData")}
          description={t("customer.orders.noDataDescription")}
        />
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {items.map((item) => (
            <Card key={item.transactionId} variant="outlined">
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700}>
                    {item.transactionId}
                  </Typography>
                  <Chip
                    label={item.state}
                    color={STATUS_COLORS[item.state] || "default"}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t("customer.orders.amount", {
                    amount: `${item.currency} ${item.amount}`,
                  })}
                </Typography>
                <PickupSchedule order={item} />
                {item.state === "EXPIRED" && (
                  <Typography>{t("customer.orders.expired")}</Typography>
                )}
                {item.preparationStatus &&
                  !["EXPIRED", "CANCELLED", "REFUNDED", "HANDED_OVER"].includes(item.state) && (
                  <Typography>{t(`pickup.status.${item.preparationStatus}`)}</Typography>
                )}
                {item.channel === "MOBILE_ORDER" && item.paymentMode === "PAY_AT_COUNTER" &&
                  item.state === "CASH_PENDING_CONFIRMATION" && (
                    <>
                      <Typography>{t("customer.cart.payAtCollectionInstructions")}</Typography>
                      {item.arrivalStatus === "ARRIVED" ? (
                        <Typography>{t("pickup.arrived")}</Typography>
                      ) : (
                        <CollectionToken transactionId={item.transactionId} purpose="arrival" />
                      )}
                    </>
                  )}
                {item.channel === "MOBILE_ORDER" &&
                  item.preparationStatus === "READY" &&
                  ["PAYMENT_SUCCESS", "READY_FOR_HANDOVER"].includes(item.state) && (
                    <CollectionToken transactionId={item.transactionId} />
                  )}
                <Typography variant="body2" color="text.secondary">
                  {t("customer.orders.createdAt", {
                    date: item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "",
                  })}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Button disabled={page === 0} onClick={() => setPage(page - 1)}>{t("pickup.previous")}</Button>
        <Button disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>{t("pickup.next")}</Button>
      </Box>
    </Box>
  );
}
