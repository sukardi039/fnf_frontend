import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Search as SearchIcon,
  ThumbUp as ApproveIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { PageHeader, LoadingState, EmptyState } from "../common";
import { request } from "../../helpers/axios_helper";
import { approveTransformation } from "../../helpers/transformation_helper";

export default function TransformationApprovalList() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await request(
        "GET",
        "/api/v1/transformations?status=PENDING_APPROVAL",
        null,
        {
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message || t("transformationApproval.loadFailed"),
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
        const response = await request(
          "GET",
          "/api/v1/transformations?status=PENDING_APPROVAL",
          null,
          {
            skipAuthRedirect: true,
            skipBackendErrorDialog: true,
          },
        );
        if (!active) return;
        setItems(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message ||
            t("transformationApproval.loadFailed"),
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

  const handleApprove = async () => {
    if (!selected || !reason.trim()) return;
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await approveTransformation(selected.transformationId, {
        reason: reason.trim(),
      });
      setResult(response.data);
      setSelected(null);
      setReason("");
      load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          t("transformationApproval.approveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={t("transformationApproval.title")}
        subtitle={t("transformationApproval.subtitle")}
        icon={ApproveIcon}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t("transformationApproval.approved", {
            transformationId: result.transformationId,
            status: result.status,
          })}
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
          placeholder={t("transformationApproval.searchPlaceholder")}
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

      {loading && <LoadingState message={t("common.loading")} />}

      {!loading && filteredRows.length === 0 && !error && (
        <EmptyState
          title={t("transformationApproval.noData")}
          description={
            search
              ? t("transformationApproval.noSearchResults")
              : t("transformationApproval.noDataDescription")
          }
        />
      )}

      {!loading && filteredRows.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {t("transformationApproval.transformationId")}
                </TableCell>
                <TableCell>{t("transformationApproval.recipeId")}</TableCell>
                <TableCell>{t("transformationApproval.storeId")}</TableCell>
                <TableCell>{t("transformationApproval.yield")}</TableCell>
                <TableCell>{t("transformationApproval.waste")}</TableCell>
                <TableCell>{t("transformationApproval.status")}</TableCell>
                <TableCell>{t("transformationApproval.createdBy")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.transformationId}</TableCell>
                  <TableCell>{row.recipeId}</TableCell>
                  <TableCell>{row.storeId}</TableCell>
                  <TableCell>
                    {row.yieldPercent
                      ? `${Math.round(row.yieldPercent * 100)}%`
                      : "—"}
                  </TableCell>
                  <TableCell>{row.wasteQuantity ?? "—"}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.createdBy ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<ApproveIcon />}
                      onClick={() => setSelected(row)}
                    >
                      {t("transformationApproval.approve")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("transformationApproval.approveTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("transformationApproval.approveBody", {
              transformationId: selected?.transformationId,
            })}
          </Typography>
          <TextField
            label={t("transformationApproval.reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={saving}>
            {t("basic.cancel")}
          </Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            disabled={saving || !reason.trim()}
          >
            {saving
              ? t("common.saving")
              : t("transformationApproval.confirmApprove")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
