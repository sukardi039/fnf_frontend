import React, { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { request } from "../../helpers/axios_helper";

const RefundRequestForm = () => {
  const { t } = useTranslation();
  const [transactionId, setTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refund, setRefund] = useState(null);

  const validate = () => {
    const nextErrors = {};
    if (!transactionId.trim()) {
      nextErrors.transactionId = t(
        "refundRequest.validation.transactionRequired",
      );
    }
    if (!reason.trim()) {
      nextErrors.reason = t("refundRequest.validation.reasonRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError("");
    setRefund(null);
    try {
      const response = await request(
        "POST",
        "/api/refunds",
        {
          transactionId: transactionId.trim(),
          reason: reason.trim(),
        },
        {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setRefund(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("refundRequest.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("refundRequest.title")}
        subtitle={t("refundRequest.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 880 }}>
          {error}
        </Alert>
      )}
      {refund && (
        <Alert severity="success" sx={{ mb: 2, maxWidth: 880 }}>
          {t("refundRequest.created", {
            refundId: refund.refundId,
            transactionId: refund.transactionId,
            status: refund.status,
          })}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          maxWidth: 880,
        }}
      >
        <TextField
          label={t("refundRequest.transactionId")}
          value={transactionId}
          onChange={(event) => {
            setTransactionId(event.target.value);
            setErrors((current) => ({ ...current, transactionId: "" }));
            setError("");
            setRefund(null);
          }}
          error={Boolean(errors.transactionId)}
          helperText={errors.transactionId}
          required
          fullWidth
        />
        <TextField
          label={t("refundRequest.reason")}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setErrors((current) => ({ ...current, reason: "" }));
            setError("");
            setRefund(null);
          }}
          inputProps={{ maxLength: 500 }}
          error={Boolean(errors.reason)}
          helperText={errors.reason}
          required
          multiline
          minRows={3}
          fullWidth
        />
      </Box>

      <Button
        type="submit"
        variant="contained"
        disabled={saving}
        sx={{ mt: 3 }}
      >
        {t("refundRequest.submit")}
      </Button>
    </Box>
  );
};

export default RefundRequestForm;
