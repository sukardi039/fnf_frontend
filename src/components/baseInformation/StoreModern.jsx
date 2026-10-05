import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  BlockListItem,
  LoadMoreBlockList,
} from "../common";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import HelpDialog from "../common/HelpDialog";
import { listStores, deleteStore } from "../../helpers/store_api";
import StoreForm from "./StoreForm";

const normalizeStore = (item) => ({
  id: item.storeId,
  storeId: item.storeId,
  storeName: item.storeName,
  companyId: item.companyId,
  timezone: item.timezone,
  address: item.address,
  latitude: item.latitude,
  longitude: item.longitude,
  active: item.active,
});

const StoreModern = () => {
  const { t } = useTranslation();
  const { shouldUseBlockLayout } = useResponsiveLayout();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [deleteStoreData, setDeleteStoreData] = useState(null);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await listStores();
        if (!active) return;
        const data = Array.isArray(response.data?.items)
          ? response.data.items
          : Array.isArray(response.data)
            ? response.data
            : [];
        setItems(data.map(normalizeStore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("storeList.loadFailed"));
      } finally {
        if (active) {
          setLoading(false);
          setRefresh(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t, refresh]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.storeId, item.storeName, item.companyId, item.address].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
      ),
    );
  }, [items, search]);

  const handleAdd = () => {
    setSelectedStore(null);
    setShowForm(true);
  };

  const handleEdit = (store) => {
    setSelectedStore(store);
    setShowForm(true);
  };

  const handleDelete = (store) => {
    setDeleteStoreData(store);
  };

  const confirmDelete = async () => {
    if (!deleteStoreData) return;
    try {
      await deleteStore(deleteStoreData.storeId);
      setDeleteStoreData(null);
      setRefresh(true);
    } catch (err) {
      setError(err?.response?.data?.message || t("storeList.deleteFailed"));
    }
  };

  const handleFormClose = (saved) => {
    setShowForm(false);
    setSelectedStore(null);
    if (saved) setRefresh(true);
  };

  const columns = useMemo(
    () => [
      {
        field: "storeId",
        headerName: t("storeList.storeId"),
        width: 150,
      },
      {
        field: "storeName",
        headerName: t("storeList.storeName"),
        flex: 1,
        minWidth: 220,
      },
      {
        field: "companyId",
        headerName: t("storeList.companyId"),
        width: 150,
      },
      {
        field: "timezone",
        headerName: t("storeList.timezone"),
        width: 160,
      },
      {
        field: "latitude",
        headerName: t("storeList.latitude"),
        width: 120,
      },
      {
        field: "longitude",
        headerName: t("storeList.longitude"),
        width: 120,
      },
      {
        field: "active",
        headerName: t("storeList.active"),
        width: 100,
        renderCell: (params) => (
          <Chip
            label={params.value ? t("basic.yes") : t("basic.no")}
            color={params.value ? "success" : "default"}
            size="small"
          />
        ),
      },
      {
        field: "actions",
        headerName: t("basic.actions"),
        width: 120,
        sortable: false,
        filterable: false,
        headerAlign: "center",
        align: "center",
        renderCell: (params) => (
          <Box>
            <IconButton
              size="small"
              onClick={() => handleEdit(params.row)}
              color="primary"
            >
              <EditIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleDelete(params.row)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        ),
      },
    ],
    [t],
  );

  const blockColumnDefs = useMemo(
    () =>
      columns
        .filter((c) => c.field !== "actions")
        .map((c) => ({ field: c.field, label: c.headerName })),
    [columns],
  );

  if (showForm) {
    return <StoreForm store={selectedStore} onCancel={handleFormClose} />;
  }

  return (
    <Box>
      <PageHeader
        title={t("storeList.title")}
        subtitle={t("storeList.subtitle")}
        icon={StoreIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("storeList.add")}
        onActionClick={handleAdd}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("storeList.helpTitle")}
        content={t("storeList.helpBody")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {deleteStoreData && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("storeList.confirmDelete", {
            storeId: deleteStoreData.storeId,
            storeName: deleteStoreData.storeName,
          })}
          <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={confirmDelete}
            >
              {t("basic.delete")}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setDeleteStoreData(null)}
            >
              {t("basic.cancel")}
            </Button>
          </Box>
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
          placeholder={t("storeList.searchPlaceholder")}
          size="small"
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {loading ? (
        <LoadingState message={t("storeList.loading")} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={t("storeList.noData")}
          description={
            search
              ? t("storeList.noSearchResults")
              : t("storeList.noDataDescription")
          }
          actionLabel={!search ? t("storeList.add") : null}
          onActionClick={!search ? handleAdd : null}
        />
      ) : shouldUseBlockLayout ? (
        <LoadMoreBlockList
          items={filteredItems}
          renderItem={(item, idx) => (
            <BlockListItem
              key={item.id || idx}
              columnDefs={blockColumnDefs}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
            />
          )}
        />
      ) : (
        <Box
          sx={{
            height: 600,
            width: "100%",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          <DataGrid
            rows={filteredItems}
            columns={columns}
            getRowId={(row) => row.id}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            pageSizeOptions={[5, 10, 25, 50]}
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
              "& .MuiDataGrid-footerContainer": {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
                minHeight: "52px",
                gap: "12px",
              },
              "& .MuiTablePagination-root": {
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "16px",
              },
              "& .MuiTablePagination-displayedRows": {
                margin: 0,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
              },
              "& .MuiTablePagination-selectLabel": {
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              },
              "& .MuiTablePagination-select": {
                display: "flex",
                alignItems: "center",
              },
              "& .MuiTablePagination-actions": {
                display: "flex",
                alignItems: "center",
                marginLeft: 0,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default StoreModern;
