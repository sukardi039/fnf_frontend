import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LoadingState, EmptyState } from "../common";
import { isCurrentCustomerOrder, listAllCustomerTransactions } from "../../helpers/customer_cart_helper";
import { getCustomerInfo } from "../../helpers/customer_helper";
import CollectionToken from "./CollectionToken";
import PickupSchedule from "./PickupSchedule";
import PickupLifecycleNotice from "./PickupLifecycleNotice";
import ProductThumbnail from "../common/ProductThumbnail";
import useProductPictures from "../../hooks/useProductPictures";
import { isPickupBlocked } from "../../helpers/pickup_lifecycle_helper";

const STATUS_COLORS = {
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
const PAGE_SIZE = 20;

export default function CustomerOrders() {
  const customer = useMemo(() => getCustomerInfo(), []);
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [view, setView] = useState("CURRENT");
  const filteredItems = useMemo(
    () => items
      .filter((item) => isCurrentCustomerOrder(item) === (view === "CURRENT"))
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)),
    [items, view],
  );
  const total = filteredItems.length;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
  const pageItems = filteredItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const { catalogPictures, pictureError } = useProductPictures(
    pageItems.flatMap((order) => Array.isArray(order.items) ? order.items.filter(Boolean) : []),
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const orders = await listAllCustomerTransactions(customer?.customerId);
        if (!active) return;
        setItems(orders);
        window.dispatchEvent(new Event("customer:orders:refresh"));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("customer.orders.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [t, customer?.customerId, revision]);

  return (
    <Box sx={{ px: 2, pb: 2, maxWidth: 640, mx: "auto", minWidth: 0 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="h6" component="h1">{t("customer.orders.title")}</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={loading}
          onClick={() => { setPage(0); setRevision((value) => value + 1); }}
        >
          {t("pickup.refresh")}
        </Button>
      </Box>
      <Tabs
        value={view}
        onChange={(_, value) => { setView(value); setPage(0); }}
        variant="fullWidth"
        aria-label={t("customer.orders.views")}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="CURRENT" label={t("customer.orders.current")} id="orders-current-tab" aria-controls="orders-panel" />
        <Tab value="PAST" label={t("customer.orders.past")} id="orders-past-tab" aria-controls="orders-panel" />
      </Tabs>
      <Box role="tabpanel" id="orders-panel" aria-labelledby={view === "CURRENT" ? "orders-current-tab" : "orders-past-tab"}>
        {!loading && !error && pictureError && (
          <Alert severity="warning" sx={{ mb: 2 }}>{t("customer.cart.picturesFailed")}</Alert>
        )}
        {loading ? <LoadingState message={t("customer.orders.loading")} /> : error ? (
          <Alert severity="error">{error}</Alert>
        ) : total === 0 ? (
          <EmptyState
            title={t(view === "CURRENT" ? "customer.orders.noCurrent" : "customer.orders.noPast")}
            description={t(view === "CURRENT" ? "customer.orders.noCurrentDescription" : "customer.orders.noPastDescription")}
          />
        ) : (
          <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
            {pageItems.map((item) => {
              const isActive = isCurrentCustomerOrder(item);
              const cashArrival = item.channel === "MOBILE_ORDER" && item.paymentMode === "PAY_AT_COUNTER" &&
                item.state === "CASH_PENDING_CONFIRMATION" && !isPickupBlocked(item);
              const collectionReady = item.channel === "MOBILE_ORDER" && item.preparationStatus === "READY" &&
                !isPickupBlocked(item) && ["PAYMENT_SUCCESS", "READY_FOR_HANDOVER"].includes(item.state);
              const reference = item.transactionId.length > 20 ? `#${item.transactionId.slice(-8)}` : item.transactionId;
              return (
                <Card
                  key={item.transactionId}
                  variant="outlined"
                  sx={{ minWidth: 0, boxShadow: "none", background: "background.paper", "&:hover": { transform: "none", boxShadow: "none" } }}
                >
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start", mb: 1.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">{t("customer.orders.orderReference")}</Typography>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{reference}</Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={t(`customer.orders.status.${item.state}`, { defaultValue: t("customer.orders.status.unknown") })}
                      color={STATUS_COLORS[item.state] || "default"}
                      size="small"
                      sx={{ mb: 1.5, maxWidth: "100%", height: "auto", minHeight: 26, "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 } }}
                    />
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                        {t("customer.orders.items")}
                      </Typography>
                      {Array.isArray(item.items) && item.items.length > 0 &&
                        new Set(item.items.map((line) => line?.saleLineId)).size === item.items.length &&
                        item.items.every((line) => typeof line?.saleLineId === "string" && line.saleLineId.trim() &&
                          typeof line.productName === "string" && line.productName.trim() &&
                          typeof line.uom === "string" && line.uom.trim() &&
                          (typeof line.quantity === "number" || typeof line.quantity === "string") &&
                          Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0) ? (
                          <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gap: 1 }}>
                            {item.items.map((line) => (
                              <Box component="li" key={line.saleLineId}
                                sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 1, alignItems: "center" }}>
                                <ProductThumbnail picture={line.productPicture || catalogPictures[line.skuId]} alt={line.productName} />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{line.productName}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {line.quantity} {line.uom}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Alert severity="warning" variant="outlined" sx={{ py: 0 }}>
                            {t("customer.orders.itemsUnavailable")}
                          </Alert>
                        )}
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{t("customer.orders.total")}</Typography>
                        <Typography variant="h6">{item.currency} {item.amount}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "grid", gap: 1 }}>
                      <PickupSchedule order={item} compact />
                      <PickupLifecycleNotice order={item} />
                      {item.state === "EXPIRED" && !isActive && (
                        <Typography variant="body2" color="text.secondary">{t("customer.orders.expired")}</Typography>
                      )}
                      {item.preparationStatus && !["EXPIRED", "CANCELLED", "REFUNDED", "HANDED_OVER"].includes(item.state) && (
                        <Typography variant="body2" color="text.secondary">{t(`pickup.status.${item.preparationStatus}`)}</Typography>
                      )}
                      {cashArrival && (
                        <>
                          <Divider />
                          {item.arrivalStatus === "ARRIVED" ? (
                            <Typography variant="body2">{t("pickup.arrived")}</Typography>
                          ) : (
                            <Typography variant="body2">{t("customer.orders.arrivalInstructions")}</Typography>
                          )}
                          {item.arrivalStatus !== "ARRIVED" && (
                            <Box sx={{ "& .MuiButton-root": { width: "100%", minHeight: 44, border: 1, borderColor: "divider" } }}>
                              <CollectionToken transactionId={item.transactionId} purpose="arrival" />
                            </Box>
                          )}
                        </>
                      )}
                      {collectionReady && (
                        <Box sx={{ "& .MuiButton-root": { width: "100%", minHeight: 44, border: 1, borderColor: "divider" } }}>
                          <CollectionToken transactionId={item.transactionId} />
                        </Box>
                      )}
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="details" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                      <Box component="summary" sx={{ cursor: "pointer", py: 0.5 }}>{t("customer.orders.details")}</Box>
                      <Typography variant="caption" component="p" sx={{ overflowWrap: "anywhere", mt: 1 }}>
                        {t("customer.orders.orderReference")}: {item.transactionId}
                      </Typography>
                      <Typography variant="caption" component="p">
                        {t("customer.orders.createdAt", { date: item.createdAt ? new Date(item.createdAt).toLocaleString() : "" })}
                      </Typography>
                      {cashArrival && (
                        <Typography variant="body2" sx={{ mt: 1 }}>{t("customer.cart.payAtCollectionInstructions")}</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
        {!loading && !error && total > PAGE_SIZE && (
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mt: 2 }}>
            <Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("pickup.previous")}</Button>
            <Button disabled={(currentPage + 1) * PAGE_SIZE >= total} onClick={() => setPage(currentPage + 1)}>{t("pickup.next")}</Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
