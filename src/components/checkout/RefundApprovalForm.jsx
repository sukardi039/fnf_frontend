import React, { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar } from "../common";
import { request } from "../../helpers/axios_helper";

const RefundApprovalForm = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    refundId: "",
    approvalNote: "",
    returnInspectionRef: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refund, setRefund] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setError("");
    setRefund(null);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.refundId.trim()) {
      nextErrors.refundId = t("refundApproval.validation.refundRequired");
    }
    if (!form.approvalNote.trim()) {
      nextErrors.approvalNote = t("refundApproval.validation.noteRequired");
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
        `/api/refunds/${encodeURIComponent(form.refundId.trim())}/approve`,
        {
          approvalNote: form.approvalNote.trim(),
          returnInspectionRef: form.returnInspectionRef.trim() || undefined,
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
          t("refundApproval.approveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("refundApproval.title")}
        subtitle={t("refundApproval.subtitle")}
      />

      <Alert severity="warning" sx={{ mb: 2, maxWidth: 880 }}>
        {t("refundApproval.independentReview")}
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 880 }}>
          {error}
        </Alert>
      )}
      {refund && (
        <Alert severity="success" sx={{ mb: 2, maxWidth: 880 }}>
          {t("refundApproval.approved", {
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
          label={t("refundApproval.refundId")}
          name="refundId"
          value={form.refundId}
          onChange={handleChange}
          error={Boolean(errors.refundId)}
          helperText={errors.refundId}
          required
          fullWidth
        />
        <TextField
          label={t("refundApproval.returnInspectionRef")}
          name="returnInspectionRef"
          value={form.returnInspectionRef}
          onChange={handleChange}
          inputProps={{ maxLength: 120 }}
          fullWidth
        />
        <TextField
          label={t("refundApproval.approvalNote")}
          name="approvalNote"
          value={form.approvalNote}
          onChange={handleChange}
          inputProps={{ maxLength: 500 }}
          error={Boolean(errors.approvalNote)}
          helperText={errors.approvalNote}
          required
          multiline
          minRows={3}
          fullWidth
          sx={{ gridColumn: { md: "1 / -1" } }}
        />
      </Box>

      <Button
        type="submit"
        variant="contained"
        disabled={saving}
        sx={{ mt: 3 }}
      >
        {t("refundApproval.approve")}
      </Button>
    </Box>
  );
};

export default RefundApprovalForm;
