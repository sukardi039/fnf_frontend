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
  Straighten as UomIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import LoadingState from "../common/LoadingState";
import HelpDialog from "../common/HelpDialog";
import { listUoms, createUom, updateUom } from "../../helpers/uom_helper";

export default function UomList() {
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
    code: "",
    name: "",
    precision: 0,
    active: true,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await listUoms({ active: undefined });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (!active) return;
        setRows(
          items.map((item, index) => ({
            id: item.uomId || `uom-${index}`,
            ...item,
          })),
        );
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("uom.loadFailed"));
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
        (row.code || "").toLowerCase().includes(term) ||
        (row.name || "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const validate = () => {
    const next = {};
    if (!form.code.trim()) next.code = t("uom.codeRequired");
    if (!form.name.trim()) next.name = t("uom.nameRequired");
    if (
      form.precision === "" ||
      Number(form.precision) < 0 ||
      Number(form.precision) > 4
    ) {
      next.precision = t("uom.precisionRequired");
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({ code: "", name: "", precision: 0, active: true });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditing(row);
    setForm({
      code: row.code || "",
      name: row.name || "",
      precision: row.precision ?? 0,
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
        code: form.code.trim(),
        name: form.name.trim(),
        precision: Number(form.precision),
        active: form.active,
      };
      if (editing) {
        await updateUom(editing.uomId, payload);
      } else {
        await createUom(payload);
      }
      setDialogOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err?.response?.data?.message || t("uom.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "code",
        headerName: t("uom.code"),
        flex: 1,
        minWidth: 100,
      },
      {
        field: "name",
        headerName: t("uom.name"),
        flex: 2,
        minWidth: 160,
      },
      {
        field: "precision",
        headerName: t("uom.precision"),
        type: "number",
        width: 100,
      },
      {
        field: "active",
        headerName: t("uom.active"),
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
        title={t("uom.title")}
        subtitle={t("uom.subtitle")}
        icon={UomIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("uom.addTitle")}
        onActionClick={handleOpenAdd}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("uom.helpTitle")}
        content={t("uom.helpBody")}
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
          placeholder={t("uom.searchPlaceholder")}
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
          title={t("uom.noData")}
          description={
            search ? t("uom.noSearchResults") : t("uom.noDataDescription")
          }
          actionLabel={!search ? t("uom.addTitle") : null}
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

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editing ? t("uom.editTitle", "Edit UOM") : t("uom.addTitle")}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label={t("uom.code")}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              error={Boolean(formErrors.code)}
              helperText={formErrors.code}
              fullWidth
              disabled={Boolean(editing)}
            />
            <TextField
              label={t("uom.name")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={Boolean(formErrors.name)}
              helperText={formErrors.name}
              fullWidth
            />
            <TextField
              label={t("uom.precision")}
              type="number"
              inputProps={{ min: 0, max: 4 }}
              value={form.precision}
              onChange={(e) =>
                setForm((f) => ({ ...f, precision: e.target.value }))
              }
              error={Boolean(formErrors.precision)}
              helperText={formErrors.precision}
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
              label={t("uom.active")}
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
