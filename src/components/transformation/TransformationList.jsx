import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Chip, InputAdornment, TextField } from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { DataGrid } from "@mui/x-data-grid";
import { EmptyState, LoadingState, PageHeader } from "../common";
import { listTransformations } from "../../helpers/transformation_helper";

const STATUS_COLORS = {
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  POSTED: "success",
  REJECTED: "error",
};

export default function TransformationList() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await listTransformations();
        if (!active) return;
        setItems(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message || t("transformationList.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [t]);

  const normalizedRows = useMemo(
    () =>
      items.map((item) => ({
        id: item.transformationId,
        transformationId: item.transformationId,
        recipeId: item.recipeId,
        storeId: item.storeId,
        status: item.status,
        yieldPercent: item.yieldPercent,
        wasteQuantity: item.wasteQuantity,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
      })),
    [items],
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return normalizedRows;
    return normalizedRows.filter((row) =>
      [row.transformationId, row.recipeId, row.storeId, row.createdBy].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
      ),
    );
  }, [normalizedRows, search]);

  const columns = useMemo(
    () => [
      {
        field: "transformationId",
        headerName: t("transformationList.transformationId"),
        flex: 1,
        minWidth: 200,
      },
      {
        field: "recipeId",
        headerName: t("transformationList.recipeId"),
        flex: 1,
        minWidth: 200,
      },
      {
        field: "storeId",
        headerName: t("transformationList.storeId"),
        width: 150,
      },
      {
        field: "status",
        headerName: t("transformationList.status"),
        width: 150,
        renderCell: (params) => (
          <Chip
            label={params.value}
            color={STATUS_COLORS[params.value] || "default"}
            size="small"
          />
        ),
      },
      {
        field: "yieldPercent",
        headerName: t("transformationList.yieldPercent"),
        width: 120,
        valueFormatter: (value) =>
          value === undefined || value === null
            ? ""
            : `${(value * 100).toFixed(2)}%`,
      },
      {
        field: "wasteQuantity",
        headerName: t("transformationList.wasteQuantity"),
        width: 130,
      },
      {
        field: "createdBy",
        headerName: t("transformationList.createdBy"),
        width: 150,
      },
      {
        field: "createdAt",
        headerName: t("transformationList.createdAt"),
        flex: 1,
        minWidth: 180,
        valueFormatter: (value) =>
          value ? new Date(value).toLocaleString() : "",
      },
    ],
    [t],
  );

  if (loading) {
    return <LoadingState message={t("transformationList.loading")} />;
  }

  return (
    <Box>
      <PageHeader
        title={t("transformationList.title")}
        subtitle={t("transformationList.subtitle")}
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
          placeholder={t("transformationList.searchPlaceholder")}
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

      {filteredRows.length === 0 && !loading ? (
        <EmptyState
          title={t("transformationList.noData")}
          description={
            search
              ? t("transformationList.noSearchResults")
              : t("transformationList.noDataDescription")
          }
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
            rows={filteredRows}
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
}
