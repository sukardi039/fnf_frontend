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
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import {
  Add as AddIcon,
  CompareArrows as ConversionIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import LoadingState from "../common/LoadingState";
import HelpDialog from "../common/HelpDialog";
import {
  listUoms,
  listUomConversions,
  createUomConversion,
} from "../../helpers/uom_helper";

export default function UomConversionList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState({
    fromUom: "",
    toUom: "",
    factor: "",
    active: true,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [uomsResponse, conversionsResponse] = await Promise.all([
          listUoms({ active: true }),
          listUomConversions({ active: undefined }),
        ]);
        const uomItems = Array.isArray(uomsResponse.data?.items)
          ? uomsResponse.data.items
          : [];
        const conversionItems = Array.isArray(conversionsResponse.data?.items)
          ? conversionsResponse.data.items
          : [];
        if (!active) return;
        setUoms(uomItems);
        setRows(
          conversionItems.map((item, index) => ({
            id: item.conversionId || `conv-${index}`,
            ...item,
          })),
        );
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t("uomConversion.loadFailed"));
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
        (row.fromUom || "").toLowerCase().includes(term) ||
        (row.toUom || "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const validate = () => {
    const next = {};
    if (!form.fromUom) next.fromUom = t("uomConversion.fromUomRequired");
    if (!form.toUom) next.toUom = t("uomConversion.toUomRequired");
    if (form.fromUom && form.toUom && form.fromUom === form.toUom) {
      next.toUom = t("uomConversion.sameUomError");
    }
    if (form.factor === "" || Number(form.factor) <= 0) {
      next.factor = t("uomConversion.factorRequired");
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleOpenAdd = () => {
    setForm({ fromUom: "", toUom: "", factor: "", active: true });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      await createUomConversion({
        fromUom: form.fromUom,
        toUom: form.toUom,
        factor: Number(form.factor),
        active: form.active,
      });
      setDialogOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err?.response?.data?.message || t("uomConversion.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "fromUom",
        headerName: t("uomConversion.fromUom"),
        flex: 1,
        minWidth: 120,
      },
      {
        field: "toUom",
        headerName: t("uomConversion.toUom"),
        flex: 1,
        minWidth: 120,
      },
      {
        field: "factor",
        headerName: t("uomConversion.factor"),
        type: "number",
        flex: 1,
        minWidth: 120,
      },
      {
        field: "active",
        headerName: t("uomConversion.active"),
        width: 100,
        renderCell: (params) =>
          params.value ? t("common.enabled") : t("common.disabled"),
      },
    ],
    [t],
  );

  return (
    <Box>
      <PageHeader
        title={t("uomConversion.title")}
        subtitle={t("uomConversion.subtitle")}
        icon={ConversionIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("uomConversion.addTitle")}
        onActionClick={handleOpenAdd}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("uomConversion.helpTitle")}
        content={t("uomConversion.helpBody")}
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
          placeholder={t("uomConversion.searchPlaceholder")}
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
          title={t("uomConversion.noData")}
          description={
            search
              ? t("uomConversion.noSearchResults")
              : t("uomConversion.noDataDescription")
          }
          actionLabel={!search ? t("uomConversion.addTitle") : null}
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
        <DialogTitle>{t("uomConversion.addTitle")}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth error={Boolean(formErrors.fromUom)}>
              <InputLabel id="from-uom-label">
                {t("uomConversion.fromUom")}
              </InputLabel>
              <Select
                labelId="from-uom-label"
                value={form.fromUom}
                label={t("uomConversion.fromUom")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fromUom: e.target.value }))
                }
              >
                {uoms.map((uom) => (
                  <MenuItem key={uom.uomId || uom.code} value={uom.code}>
                    {uom.name} ({uom.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth error={Boolean(formErrors.toUom)}>
              <InputLabel id="to-uom-label">
                {t("uomConversion.toUom")}
              </InputLabel>
              <Select
                labelId="to-uom-label"
                value={form.toUom}
                label={t("uomConversion.toUom")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, toUom: e.target.value }))
                }
              >
                {uoms.map((uom) => (
                  <MenuItem key={uom.uomId || uom.code} value={uom.code}>
                    {uom.name} ({uom.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t("uomConversion.factor")}
              type="number"
              inputProps={{ min: 0, step: "any" }}
              value={form.factor}
              onChange={(e) =>
                setForm((f) => ({ ...f, factor: e.target.value }))
              }
              error={Boolean(formErrors.factor)}
              helperText={formErrors.factor}
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
              label={t("uomConversion.active")}
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
