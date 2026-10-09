import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Edit as EditIcon,
  Inventory as InventoryIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useStoreLocation } from "../../context/storeLocationContext";
import { listLossEvents, listPurchaseLots } from "../../helpers/inventory_helper";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../common";

const CONFIG = {
  lots: {
    titleKey: "purchaseLot.listTitle",
    subtitleKey: "purchaseLot.listSubtitle",
    loadFailedKey: "purchaseLot.listFailed",
    noDataKey: "purchaseLot.noData",
    noDataDescriptionKey: "purchaseLot.noDataDescription",
    searchKey: "purchaseLot.search",
    addKey: "purchaseLot.add",
    basePath: "/inventory/lots",
    load: listPurchaseLots,
    columns: [
      ["lotId", "purchaseLot.lotId"],
      ["supplierName", "purchaseLot.supplier"],
      ["productName", "purchaseLot.product"],
      ["receivedQuantity", "purchaseLot.quantity"],
      ["uom", "purchaseLot.uom"],
      ["totalCost", "purchaseLot.totalCost"],
      ["receivedAt", "purchaseLot.receivedAt"],
      ["expiryDate", "purchaseLot.expiryDate"],
    ],
  },
  losses: {
    titleKey: "lossEvent.listTitle",
    subtitleKey: "lossEvent.listSubtitle",
    loadFailedKey: "lossEvent.listFailed",
    noDataKey: "lossEvent.noData",
    noDataDescriptionKey: "lossEvent.noDataDescription",
    searchKey: "lossEvent.search",
    addKey: "lossEvent.add",
    basePath: "/inventory/loss-events",
    load: listLossEvents,
    columns: [
      ["lossEventId", "lossEvent.id"],
      ["lotId", "lossEvent.lotId"],
      ["productName", "lossEvent.product"],
      ["quantity", "lossEvent.quantity"],
      ["uom", "lossEvent.uom"],
      ["reasonCode", "lossEvent.reasonCode"],
      ["createdAt", "lossEvent.createdAt"],
    ],
  },
};

const getDisplayValue = (field, value) => {
  if (value == null || value === "") return "";
  if (field.endsWith("At")) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  return String(value);
};

const InventoryRecordList = ({ kind }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { storeId } = useStoreLocation();
  const config = CONFIG[kind];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [rowCount, setRowCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!storeId) {
        setRecords([]);
        setRowCount(0);
        setError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      setRecords([]);
      setRowCount(0);
      try {
        const response = await config.load({
          storeId,
          ...paginationModel,
          search,
        });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (active) {
          setRecords(items);
          setRowCount(Number(response.data?.total) || items.length);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError?.response?.data?.message ||
              t(config.loadFailedKey),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [config, paginationModel, search, storeId, t]);

  const columns = useMemo(
    () => [
      ...config.columns.map(([field, key]) => ({
        field,
        headerName: t(key),
        flex: 1,
        minWidth: 120,
        valueGetter: (_value, row) => getDisplayValue(field, row[field]),
      })),
      {
        field: "actions",
        headerName: t("basic.actions"),
        width: 90,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) =>
          row.amendable === true ? (
            <IconButton
              size="small"
              aria-label={t("inventory.amend")}
              onClick={() =>
                navigate(`${config.basePath}/amend`, {
                  state: { record: row },
                })
              }
            >
              <EditIcon fontSize="small" />
            </IconButton>
          ) : null,
      },
    ],
    [config, navigate, t],
  );

  if (loading) return <LoadingState message={t("common.loading")} />;

  return (
    <Box>
      <PageHeader
        title={t(config.titleKey)}
        subtitle={t(config.subtitleKey)}
        icon={InventoryIcon}
        actionLabel={t(config.addKey)}
        onActionClick={() => navigate(`${config.basePath}/new`)}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPaginationModel((current) => ({ ...current, page: 0 }));
        }}
        placeholder={t(config.searchKey)}
        size="small"
        sx={{ minWidth: 300, mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      {!loading && records.length === 0 ? (
        <EmptyState
          title={t(config.noDataKey)}
          description={t(config.noDataDescriptionKey)}
        />
      ) : (
        <Box sx={{ height: 600, width: "100%", bgcolor: "background.paper" }}>
          <DataGrid
            rows={records}
            columns={columns}
            getRowId={(row) =>
              kind === "lots" ? row.lotId : row.lossEventId
            }
            rowCount={rowCount}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[5, 10, 25, 50]}
            disableRowSelectionOnClick
          />
        </Box>
      )}
    </Box>
  );
};

InventoryRecordList.propTypes = {
  kind: PropTypes.oneOf(["lots", "losses"]).isRequired,
};

export default InventoryRecordList;
