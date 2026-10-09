import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  LocalOffer as LocalOfferIcon,
  Publish as PublishIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  BlockListItem,
  EmptyState,
  LoadMoreBlockList,
  LoadingState,
  PageHeader,
} from "../common";
import HelpDialog from "../common/HelpDialog";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  deletePriceRule,
  listPriceRules,
  publishPriceRule,
} from "./productApi";
import { canPublishPriceRule, getPriceRuleStatus } from "./priceRuleUtils";

const PriceRuleList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { shouldUseBlockLayout } = useResponsiveLayout();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [publishDialog, setPublishDialog] = useState(null);

  const loadRules = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listPriceRules();
      setRules(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || t("priceRule.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await listPriceRules();
        if (!active) return;
        setRules(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message || t("priceRule.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t]);

  const rows = rules.map((rule) => {
    const status = getPriceRuleStatus(rule);
    return {
      ...rule,
      id: rule.ruleId,
      status,
      canEdit: ["DRAFT", "EXPIRED"].includes(status),
      canPublish: canPublishPriceRule({ ...rule, status }),
      displayProduct: rule.productName
        ? `${rule.productName} (${rule.skuId})`
        : rule.skuId,
      displayDiscount:
        rule.discountType === "PERCENT"
          ? `${rule.discountValue}%`
          : `${rule.currency || ""} ${rule.discountValue}`,
      displayPeriod: `${t("priceRule.from")} ${rule.startAt ? new Date(rule.startAt).toLocaleString() : ""} ${t("priceRule.to")} ${rule.endAt ? new Date(rule.endAt).toLocaleString() : ""}`,
      displayStatus: t(`priceRule.status.${status}`, status),
    };
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = normalizedSearch
    ? rows.filter((row) =>
        [
          row.ruleName,
          row.slogan,
          row.skuId,
          row.productName,
          row.displayStatus,
        ].some((value) =>
          String(value || "").toLowerCase().includes(normalizedSearch),
        ),
      )
    : rows;

  const handlePublish = async () => {
    if (!publishDialog) return;
    try {
      await publishPriceRule(publishDialog.ruleId);
      setPublishDialog(null);
      await loadRules();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          (requestError?.response?.status === 409
            ? t("priceRule.publishConflict")
            : t("priceRule.publishFailed")),
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await deletePriceRule(deleteDialog.ruleId);
      setDeleteDialog(null);
      await loadRules();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || t("priceRule.deleteFailed"),
      );
    }
  };

  const columns = [
    {
      field: "ruleName",
      headerName: t("priceRule.ruleName"),
      flex: 1.2,
      minWidth: 160,
    },
    {
      field: "slogan",
      headerName: t("priceRule.slogan"),
      flex: 1,
      minWidth: 140,
    },
    {
      field: "displayProduct",
      headerName: t("priceRule.product"),
      flex: 1.2,
      minWidth: 160,
    },
    {
      field: "displayDiscount",
      headerName: t("priceRule.discount"),
      width: 120,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "displayPeriod",
      headerName: t("priceRule.period"),
      flex: 2,
      minWidth: 240,
    },
    {
      field: "priority",
      headerName: t("priceRule.priority"),
      width: 90,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "displayStatus",
      headerName: t("priceRule.status"),
      width: 120,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "actions",
      headerName: t("basic.actions"),
      width: 130,
      align: "center",
      headerAlign: "center",
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {params.row.canPublish && (
            <IconButton
              size="small"
              color="primary"
              onClick={() => setPublishDialog(params.row)}
              aria-label={t("priceRule.publish")}
            >
              <PublishIcon fontSize="small" />
            </IconButton>
          )}
          {params.row.canEdit && (
            <IconButton
              size="small"
              onClick={() =>
                navigate("/price-rules/edit", { state: { priceRule: params.row } })
              }
              aria-label={t("priceRule.edit")}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            color="error"
            onClick={() => setDeleteDialog(params.row)}
            aria-label={t("priceRule.delete")}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const blockColumnDefs = columns
    .filter((column) => column.field !== "actions")
    .map((column) => ({ field: column.field, label: column.headerName }));

  if (loading) {
    return <LoadingState message={t("priceRule.loading")} />;
  }

  return (
    <Box>
      <PageHeader
        title={t("priceRule.listTitle")}
        subtitle={t("priceRule.listSubtitle")}
        icon={LocalOfferIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("priceRule.addTitle")}
        onActionClick={() => navigate("/price-rules/new")}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("priceRule.helpTitle")}
        content={t("priceRule.helpBody")}
      />

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
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("priceRule.searchPlaceholder")}
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {filteredRows.length === 0 ? (
        <EmptyState
          title={t("priceRule.noData")}
          description={
            search
              ? t("priceRule.noSearchResults")
              : t("priceRule.noDataDescription")
          }
          actionLabel={!search ? t("priceRule.addTitle") : null}
          onActionClick={!search ? () => navigate("/price-rules/new") : null}
        />
      ) : shouldUseBlockLayout ? (
        <LoadMoreBlockList
          items={filteredRows}
          renderItem={(rule) => (
            <BlockListItem
              key={rule.ruleId}
              columnDefs={blockColumnDefs}
              item={rule}
              extraContent={
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  {rule.canPublish && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PublishIcon />}
                      onClick={() => setPublishDialog(rule)}
                    >
                      {t("priceRule.publish")}
                    </Button>
                  )}
                  {rule.canEdit && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() =>
                        navigate("/price-rules/edit", {
                          state: { priceRule: rule },
                        })
                      }
                    >
                      {t("basic.edit")}
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialog(rule)}
                  >
                    {t("basic.delete")}
                  </Button>
                </Box>
              }
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
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row.ruleId}
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
              "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.50" },
            }}
          />
        </Box>
      )}

      <Dialog open={Boolean(publishDialog)} onClose={() => setPublishDialog(null)}>
        <DialogTitle>{t("priceRule.confirmPublishTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("priceRule.confirmPublish", {
              ruleName: publishDialog?.ruleName,
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialog(null)}>
            {t("basic.cancel")}
          </Button>
          <Button onClick={handlePublish} variant="contained" color="primary">
            {t("priceRule.publish")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>{t("priceRule.confirmDeleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("priceRule.confirmDelete", { ruleName: deleteDialog?.ruleName })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>
            {t("basic.cancel")}
          </Button>
          <Button onClick={handleDelete} variant="contained" color="error">
            {t("basic.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PriceRuleList;
