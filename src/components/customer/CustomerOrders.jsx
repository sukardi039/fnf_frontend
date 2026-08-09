import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LoadingState, EmptyState } from "../common";
import { listCustomerTransactions } from "../../helpers/customer_cart_helper";
import { getCustomerInfo } from "../../helpers/customer_helper";

const STATUS_COLORS = {
  CART_CREATED: "default",
  CHECKOUT_PENDING: "default",
  PAYMENT_PENDING: "warning",
  PAYMENT_SUCCESS: "success",
  PAYMENT_FAILED: "error",
  READY_FOR_HANDOVER: "info",
  HANDED_OVER: "success",
  CANCELLED: "error",
  REFUNDED: "error",
  EXPIRED: "error",
};

export default function CustomerOrders() {
  const { t } = useTranslation();
  const customer = useMemo(() => getCustomerInfo(), []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await listCustomerTransactions({
          customerId: customer?.customerId,
        });
        if (!active) return;
        setItems(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
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
  }, [t, customer?.customerId]);

  if (loading) {
    return <LoadingState message={t("customer.orders.loading")} />;
  }

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {items.length === 0 ? (
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
    </Box>
  );
}
