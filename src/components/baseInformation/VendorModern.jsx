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
import { listVendors, deleteVendor } from "../../helpers/vendor_api";
import VendorForm from "./VendorForm";

const normalizeVendor = (item) => ({
  id: item.vendorId,
  vendorId: item.vendorId,
  vendorName: item.vendorName,
  contactName: item.contactName,
  email: item.email,
  phone: item.phone,
  active: item.active,
});

const VendorModern = () => {
  const { t } = useTranslation();
  const { shouldUseBlockLayout } = useResponsiveLayout();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [deleteVendorData, setDeleteVendorData] = useState(null);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await listVendors();
        if (!active) return;
        const data = Array.isArray(response.data?.items)
          ? response.data.items
          : Array.isArray(response.data)
            ? response.data
            : [];
        setItems(data.map(normalizeVendor));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("vendorList.loadFailed"));
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
      [
        item.vendorId,
        item.vendorName,
        item.contactName,
        item.email,
        item.phone,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [items, search]);

  const handleAdd = () => {
    setSelectedVendor(null);
    setShowForm(true);
  };

  const handleEdit = (vendor) => {
    setSelectedVendor(vendor);
    setShowForm(true);
  };

  const handleDelete = (vendor) => {
    setDeleteVendorData(vendor);
  };

  const confirmDelete = async () => {
    if (!deleteVendorData) return;
    try {
      await deleteVendor(deleteVendorData.vendorId);
      setDeleteVendorData(null);
      setRefresh(true);
    } catch (err) {
      setError(err?.response?.data?.message || t("vendorList.deleteFailed"));
    }
  };

  const handleFormClose = (saved) => {
    setShowForm(false);
    setSelectedVendor(null);
    if (saved) setRefresh(true);
  };

  const columns = useMemo(
    () => [
      {
        field: "vendorId",
        headerName: t("vendorList.vendorId"),
        width: 150,
      },
      {
        field: "vendorName",
        headerName: t("vendorList.vendorName"),
        flex: 1,
        minWidth: 220,
      },
      {
        field: "contactName",
        headerName: t("vendorList.contactName"),
        width: 180,
      },
      {
        field: "email",
        headerName: t("vendorList.email"),
        flex: 1,
        minWidth: 200,
      },
      {
        field: "active",
        headerName: t("vendorList.active"),
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
    return <VendorForm vendor={selectedVendor} onCancel={handleFormClose} />;
  }

  return (
    <Box>
      <PageHeader
        title={t("vendorList.title")}
        subtitle={t("vendorList.subtitle")}
        icon={StoreIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("vendorList.add")}
        onActionClick={handleAdd}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("vendorList.helpTitle")}
        content={t("vendorList.helpBody")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {deleteVendorData && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("vendorList.confirmDelete", {
            vendorId: deleteVendorData.vendorId,
            vendorName: deleteVendorData.vendorName,
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
              onClick={() => setDeleteVendorData(null)}
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
          placeholder={t("vendorList.searchPlaceholder")}
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
        <LoadingState message={t("vendorList.loading")} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={t("vendorList.noData")}
          description={
            search
              ? t("vendorList.noSearchResults")
              : t("vendorList.noDataDescription")
          }
          actionLabel={!search ? t("vendorList.add") : null}
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

export default VendorModern;
