import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  TextField,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  Style as FormatIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import LoadingState from "../common/LoadingState";
import HelpDialog from "../common/HelpDialog";
import {
  fetchProductFormats,
  createProductFormat,
  updateProductFormat,
} from "./productApi";

export default function ProductFormatList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    formatCode: "",
    formatName: "",
    active: true,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchProductFormats(undefined);
        const items = Array.isArray(response.data) ? response.data : [];
        if (!active) return;
        setRows(
          items.map((item, index) => ({
            id: item.formatCode || `format-${index}`,
            ...item,
          })),
        );
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("productFormat.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t, refreshKey]);

  const normalizedRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        (row.formatCode || "").toLowerCase().includes(term) ||
        (row.formatName || "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const validate = () => {
    const next = {};
    if (!form.formatCode.trim()) {
      next.formatCode = t("productFormat.formatCodeRequired");
    } else if (!/^[A-Z0-9_]+$/.test(form.formatCode.trim())) {
      next.formatCode = t("productFormat.formatCodeInvalid");
    }
    if (!form.formatName.trim()) {
      next.formatName = t("productFormat.formatNameRequired");
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({ formatCode: "", formatName: "", active: true });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditing(row);
    setForm({
      formatCode: row.formatCode || "",
      formatName: row.formatName || "",
      active: row.active !== false,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        formatCode: form.formatCode.trim().toUpperCase(),
        formatName: form.formatName.trim(),
        active: form.active,
      };
      if (editing) {
        await updateProductFormat(editing.formatCode, payload);
      } else {
        await createProductFormat(payload);
      }
      setDialogOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err?.response?.data?.message || t("productFormat.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "formatCode",
        headerName: t("productFormat.formatCode"),
        flex: 1,
        minWidth: 120,
      },
      {
        field: "formatName",
        headerName: t("productFormat.formatName"),
        flex: 2,
        minWidth: 180,
      },
      {
        field: "active",
        headerName: t("productFormat.active"),
        width: 100,
        renderCell: (params) =>
          params.value ? t("common.enabled") : t("common.disabled"),
      },
      {
        field: "actions",
        headerName: "",
        width: 120,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Button size="small" onClick={() => handleOpenEdit(params.row)}>
            {t("common.edit", "Edit")}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <Box>
      <PageHeader
        title={t("productFormat.title")}
        subtitle={t("productFormat.subtitle")}
        icon={FormatIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("productFormat.addTitle")}
        onActionClick={handleOpenAdd}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("productFormat.helpTitle")}
        content={t("productFormat.helpBody")}
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
          placeholder={t("productFormat.searchPlaceholder")}
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
        <LoadingState message={t("common.loading")} />
      ) : normalizedRows.length === 0 ? (
        <EmptyState
          title={t("productFormat.noData")}
          description={
            search
              ? t("productFormat.noSearchResults")
              : t("productFormat.noDataDescription")
          }
          actionLabel={!search ? t("productFormat.addTitle") : null}
          onActionClick={!search ? handleOpenAdd : null}
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
            rows={normalizedRows}
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
            }}
          />
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editing
            ? t("productFormat.editTitle", "Edit Product Format")
            : t("productFormat.addTitle")}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label={t("productFormat.formatCode")}
              value={form.formatCode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  formatCode: e.target.value.toUpperCase(),
                }))
              }
              error={Boolean(formErrors.formatCode)}
              helperText={formErrors.formatCode}
              fullWidth
              disabled={Boolean(editing)}
              inputProps={{ style: { textTransform: "uppercase" } }}
            />
            <TextField
              label={t("productFormat.formatName")}
              value={form.formatName}
              onChange={(e) =>
                setForm((f) => ({ ...f, formatName: e.target.value }))
              }
              error={Boolean(formErrors.formatName)}
              helperText={formErrors.formatName}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
              }
              label={t("productFormat.active")}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={<AddIcon />}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
