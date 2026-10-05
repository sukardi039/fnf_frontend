import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import {
  Inventory as InventoryIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import LoadingState from "../common/LoadingState";
import HelpDialog from "../common/HelpDialog";
import { useStoreLocation } from "../../context/storeLocationContext";
import { listInventorySnapshots } from "../../helpers/inventory_helper";

export default function StockView() {
  const { t } = useTranslation();
  const { storeId: selectedStoreId } = useStoreLocation();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!selectedStoreId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await listInventorySnapshots({
          storeId: selectedStoreId,
          includeLots: true,
          pageSize: 500,
        });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (!active) return;
        setRows(
          items.map((item, index) => ({
            id: item.snapshotId || `${item.skuId}-${index}`,
            ...item,
          })),
        );
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("stockView.loadFailed"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t, selectedStoreId]);

  const normalizedRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        (row.productName || "").toLowerCase().includes(term) ||
        (row.skuId || "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const toggleExpand = (rowId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const columns = useMemo(
    () => [
      {
        field: "expand",
        headerName: "",
        width: 50,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const hasLots =
            Array.isArray(params.row.lots) && params.row.lots.length > 0;
          if (!hasLots) return null;
          const expanded = expandedRows.has(params.id);
          return (
            <IconButton size="small" onClick={() => toggleExpand(params.id)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          );
        },
      },
      {
        field: "skuId",
        headerName: t("stockView.skuId"),
        flex: 1,
        minWidth: 120,
      },
      {
        field: "productName",
        headerName: t("stockView.productName"),
        flex: 2,
        minWidth: 180,
      },
      {
        field: "uom",
        headerName: t("stockView.uom"),
        width: 80,
      },
      {
        field: "availableQuantity",
        headerName: t("stockView.available"),
        type: "number",
        width: 110,
      },
      {
        field: "reservedQuantity",
        headerName: t("stockView.reserved"),
        type: "number",
        width: 110,
      },
      {
        field: "onHandQuantity",
        headerName: t("stockView.onHand"),
        type: "number",
        width: 110,
      },
      {
        field: "weightedAverageCost",
        headerName: t("stockView.unitCost"),
        type: "number",
        width: 120,
        valueFormatter: (value) =>
          value == null ? "" : Number(value).toFixed(4),
      },
    ],
    [t, expandedRows],
  );

  const renderLots = (row) => {
    if (!Array.isArray(row.lots) || row.lots.length === 0) return null;
    return (
      <Collapse in={expandedRows.has(row.id)} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 7, pr: 2, py: 1, bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("stockView.lots")}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {row.lots.map((lot) => (
              <Box
                key={lot.lotId}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 1,
                  alignItems: "center",
                  p: 1,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">
                  <strong>{t("stockView.lotId")}:</strong> {lot.lotId}
                </Typography>
                <Typography variant="body2">
                  <strong>{t("stockView.supplierLotRef")}:</strong>{" "}
                  {lot.supplierLotRef || "-"}
                </Typography>
                <Typography variant="body2">
                  <strong>{t("stockView.receivedAt")}:</strong>{" "}
                  {lot.receivedAt
                    ? new Date(lot.receivedAt).toLocaleString()
                    : "-"}
                </Typography>
                {lot.expiryDate && (
                  <Chip
                    size="small"
                    label={`${t("stockView.expiryDate")}: ${lot.expiryDate}`}
                    color="warning"
                    variant="outlined"
                  />
                )}
                <Typography variant="body2">
                  <strong>{t("stockView.available")}:</strong>{" "}
                  {lot.availableQuantity}
                </Typography>
                <Typography variant="body2">
                  <strong>{t("stockView.reserved")}:</strong>{" "}
                  {lot.reservedQuantity}
                </Typography>
                <Typography variant="body2">
                  <strong>{t("stockView.onHand")}:</strong> {lot.onHandQuantity}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    );
  };

  const shouldUseBlockLayout = false;

  return (
    <Box>
      <PageHeader
        title={t("stockView.title")}
        subtitle={t("stockView.subtitle")}
        icon={InventoryIcon}
        onHelpClick={() => setHelpOpen(true)}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("stockView.title")}
        content={t("stockView.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("stockView.searchPlaceholder")}
          size="small"
          sx={{ minWidth: 300 }}
          disabled={!selectedStoreId}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {selectedStoreId && loading ? (
        <LoadingState message={t("common.loading")} />
      ) : normalizedRows.length === 0 ? (
        <EmptyState
          title={t("stockView.noData")}
          description={
            search
              ? t("stockView.noSearchResults")
              : t("stockView.noDataDescription")
          }
        />
      ) : shouldUseBlockLayout ? null : (
        <Box sx={{ width: "100%" }}>
          {normalizedRows.map((row) => (
            <Box key={row.id} sx={{ mb: expandedRows.has(row.id) ? 2 : 0 }}>
              <Box
                sx={{
                  height: 320,
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  boxShadow: 1,
                  overflow: "hidden",
                }}
              >
                <DataGrid
                  rows={[row]}
                  columns={columns}
                  getRowId={(r) => r.id}
                  hideFooterPagination
                  hideFooter
                  disableRowSelectionOnClick
                  autoHeight={false}
                  sx={{
                    border: 0,
                    "& .MuiDataGrid-cell:focus": { outline: "none" },
                    "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
                    "& .MuiDataGrid-columnHeaders": {
                      bgcolor: "grey.50",
                      borderRadius: 0,
                    },
                  }}
                />
              </Box>
              {renderLots(row)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
