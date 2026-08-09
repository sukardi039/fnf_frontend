import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  CheckCircle as ActivateIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import { EmptyState, LoadingState, PageHeader } from "../common";
import {
  activateTransformationRecipe,
  listTransformationRecipes,
} from "../../helpers/transformation_helper";

const STATUS_COLORS = {
  DRAFT: "default",
  ACTIVE: "success",
  RETIRED: "error",
};

export default function TransformationRecipeList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activatingId, setActivatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listTransformationRecipes();
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          t("transformationRecipeList.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await listTransformationRecipes();
        if (!active) return;
        setItems(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message ||
            t("transformationRecipeList.loadFailed"),
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
        id: item.recipeId,
        recipeId: item.recipeId,
        recipeName: item.recipeName,
        revision: item.revision,
        type: item.type,
        status: item.status,
        inputUom: item.inputUom,
      })),
    [items],
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return normalizedRows;
    return normalizedRows.filter((row) =>
      [row.recipeId, row.recipeName, row.type, row.inputUom].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [normalizedRows, search]);

  const handleActivate = async (recipeId) => {
    setActivatingId(recipeId);
    setError("");
    try {
      await activateTransformationRecipe(recipeId);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          t("transformationRecipeList.activateFailed"),
      );
    } finally {
      setActivatingId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "recipeName",
        headerName: t("transformationRecipeList.recipeName"),
        flex: 1,
        minWidth: 200,
      },
      {
        field: "revision",
        headerName: t("transformationRecipeList.revision"),
        width: 100,
      },
      {
        field: "type",
        headerName: t("transformationRecipeList.type"),
        width: 150,
      },
      {
        field: "inputUom",
        headerName: t("transformationRecipeList.inputUom"),
        width: 120,
      },
      {
        field: "status",
        headerName: t("transformationRecipeList.status"),
        width: 120,
        renderCell: (params) => (
          <Chip
            label={params.value}
            color={STATUS_COLORS[params.value] || "default"}
            size="small"
          />
        ),
      },
      {
        field: "actions",
        headerName: t("transformationRecipeList.actions"),
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) =>
          params.row.status === "DRAFT" ? (
            <Tooltip title={t("transformationRecipeList.activate")}>
              <IconButton
                onClick={() => handleActivate(params.row.recipeId)}
                disabled={activatingId === params.row.recipeId}
                color="primary"
                size="small"
              >
                <ActivateIcon />
              </IconButton>
            </Tooltip>
          ) : null,
      },
    ],
    [t, activatingId],
  );

  if (loading) {
    return <LoadingState message={t("transformationRecipeList.loading")} />;
  }

  return (
    <Box>
      <PageHeader
        title={t("transformationRecipeList.title")}
        subtitle={t("transformationRecipeList.subtitle")}
        actionLabel={t("transformationRecipeList.add")}
        onActionClick={() => navigate("/transformations/recipes/new")}
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
          placeholder={t("transformationRecipeList.searchPlaceholder")}
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
          title={t("transformationRecipeList.noData")}
          description={
            search
              ? t("transformationRecipeList.noSearchResults")
              : t("transformationRecipeList.noDataDescription")
          }
          actionLabel={!search ? t("transformationRecipeList.add") : null}
          onActionClick={
            !search ? () => navigate("/transformations/recipes/new") : null
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
