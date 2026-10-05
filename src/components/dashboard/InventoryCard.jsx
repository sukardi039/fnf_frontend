import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Typography,
  useTheme,
} from "@mui/material";
import { Inventory as InventoryIcon, Warning as WarningIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { listInventorySnapshots } from "../../helpers/inventory_helper";
import LoadingState from "../common/LoadingState";

const LOW_STOCK_THRESHOLD = 10;

const InventoryCard = ({ storeId }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await listInventorySnapshots({
          storeId,
          page: 0,
          pageSize: 100,
        });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (!active) return;

        const totalSkus = items.length;
        const outOfStock = items.filter(
          (item) => (item.quantity ?? item.availableQty ?? 0) <= 0,
        );
        const lowStock = items.filter((item) => {
          const qty = item.quantity ?? item.availableQty ?? 0;
          return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
        });

        setSummary({
          totalSkus,
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
        });
        setLowStockItems(
          lowStock
            .sort(
              (a, b) =>
                (a.quantity ?? a.availableQty ?? 0) -
                (b.quantity ?? b.availableQty ?? 0),
            )
            .slice(0, 5),
        );
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            t("dashboard.inventory.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    if (storeId) {
      load();
    } else {
      setLoading(false);
      setError(t("dashboard.inventory.noStore"));
    }

    return () => {
      active = false;
    };
  }, [storeId, t]);

  if (loading) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ p: 3 }}>
          <LoadingState message={t("dashboard.inventory.loading")} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": {
          boxShadow: theme.shadows[4],
          transform: "translateY(-2px)",
          transition: "all 0.3s ease",
        },
      }}
    >
      <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: "warning.main",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.9,
            }}
          >
            <InventoryIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t("dashboard.inventory.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.inventory.subtitle")}
            </Typography>
          </Box>
        </Box>

        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : (
          <>
            <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={t("dashboard.inventory.totalSkus", {
                  count: summary?.totalSkus ?? 0,
                })}
                color="info"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                size="small"
                icon={<WarningIcon sx={{ fontSize: 16 }} />}
                label={t("dashboard.inventory.lowStock", {
                  count: summary?.lowStockCount ?? 0,
                })}
                color="warning"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                size="small"
                label={t("dashboard.inventory.outOfStock", {
                  count: summary?.outOfStockCount ?? 0,
                })}
                color="error"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {t("dashboard.inventory.lowStockItems")}
              </Typography>
              {lowStockItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.inventory.noLowStock")}
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {lowStockItems.map((item, index) => {
                    const qty = item.quantity ?? item.availableQty ?? 0;
                    const percent = Math.min(
                      (qty / LOW_STOCK_THRESHOLD) * 100,
                      100,
                    );
                    return (
                      <Box key={item.skuId || item.productName || index}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {item.productName || item.skuId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {qty} {item.uom || ""}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          color={qty <= 0 ? "error" : "warning"}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryCard;
