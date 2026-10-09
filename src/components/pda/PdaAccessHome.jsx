import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutline as HandoverIcon,
  QrCodeScanner as ScanIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { resolvePdaScan, confirmHandover } from "../../helpers/pda_helper";

export default function PdaAccessHome() {
  const { t } = useTranslation();
  const [qrToken, setQrToken] = useState("");
  const [resolving, setResolving] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [handover, setHandover] = useState(null);

  const session = (() => {
    try {
      return JSON.parse(localStorage.getItem("pda_user_info") || "{}");
    } catch {
      return {};
    }
  })();

  const deviceId = String(session.deviceId || "").trim();
  const staffId = String(session.staffId || "").trim();
  const hasScopedIdentity = Boolean(staffId);
  const handoverEligible = transaction?.handoverEligible === true &&
    transaction?.preparationStatus === "READY";

  const handleResolve = async (event) => {
    event.preventDefault();
    const token = qrToken.trim();
    if (!token) {
      setError(t("pda.handover.tokenRequired"));
      return;
    }
    if (!hasScopedIdentity) {
      setError(t("pda.handover.identityMissing"));
      return;
    }

    setResolving(true);
    setError("");
    setTransaction(null);
    setHandover(null);
    try {
      const response = await resolvePdaScan({ qrToken: token, deviceId });
      setTransaction(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("pda.handover.resolveFailed"),
      );
    } finally {
      setResolving(false);
    }
  };

  const handleHandover = async () => {
    if (!handoverEligible) return;

    setHandingOver(true);
    setError("");
    try {
      const response = await confirmHandover(transaction.transactionId, {
        deviceId,
        staffId,
      });
      setHandover(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("pda.handover.confirmFailed"),
      );
    } finally {
      setHandingOver(false);
    }
  };

  const handleNewScan = () => {
    setQrToken("");
    setTransaction(null);
    setHandover(null);
    setError("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        sx={{ p: { xs: 2, sm: 3 }, maxWidth: 560, width: "100%" }}
        elevation={2}
      >
        <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
          {t("pda.handover.title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t("pda.handover.subtitle")}
        </Typography>

        {!hasScopedIdentity && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("pda.handover.identityMissing")}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!transaction && !handover && (
          <Box component="form" onSubmit={handleResolve}>
            <TextField
              label={t("pda.handover.collectionToken")}
              value={qrToken}
              onChange={(event) => {
                setQrToken(event.target.value);
                setError("");
              }}
              inputProps={{ maxLength: 2048 }}
              autoFocus
              multiline
              minRows={3}
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<ScanIcon />}
              disabled={resolving || !hasScopedIdentity}
              fullWidth
              sx={{ mt: 2, minHeight: 48 }}
            >
              {t("pda.handover.verify")}
            </Button>
          </Box>
        )}

        {transaction && !handover && (
          <Box>
            <Box
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}
            >
              <Box>
                <Typography variant="caption">
                  {t("pda.handover.transactionId")}
                </Typography>
                <Typography sx={{ overflowWrap: "anywhere" }}>
                  {transaction.transactionId}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption">
                  {t("pda.handover.state")}
                </Typography>
                <Typography>{transaction.state}</Typography>
              </Box>
              <Box>
                <Typography variant="caption">
                  {t("pda.handover.paymentStatus")}
                </Typography>
                <Typography>{transaction.paymentStatus}</Typography>
              </Box>
              <Box>
                <Typography variant="caption">
                  {t("pda.handover.items")}
                </Typography>
                <Typography>{transaction.summary.itemCount}</Typography>
              </Box>
              <Box sx={{ gridColumn: "1 / -1" }}>
                <Typography variant="caption">
                  {t("pda.handover.total")}
                </Typography>
                <Typography variant="h6">
                  {transaction.summary.currency} {transaction.summary.total}
                </Typography>
              </Box>
            </Box>

            <Alert
              severity={handoverEligible ? "success" : "warning"}
              sx={{ mt: 2 }}
            >
              {handoverEligible
                ? t("pda.handover.eligible")
                : t("pda.handover.notEligible")}
            </Alert>

            <Button
              component={RouterLink}
              to={`/pda/pickup?${new URLSearchParams({ transactionId: transaction.transactionId })}`}
              fullWidth sx={{ mt: 1 }}
            >
              {t("pickup.title")}
            </Button>
            {handoverEligible && (
              <Button
                variant="contained"
                color="success"
                startIcon={<HandoverIcon />}
                onClick={handleHandover}
                disabled={handingOver}
                fullWidth
                sx={{ mt: 2, minHeight: 48 }}
              >
                {t("pda.handover.confirm")}
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={handleNewScan}
              fullWidth
              sx={{ mt: 1 }}
            >
              {t("pda.handover.newScan")}
            </Button>
          </Box>
        )}

        {handover && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              {t("pda.handover.completed", {
                transactionId: handover.transactionId,
                handoverEventId: handover.handoverEventId,
                handoverAt: new Date(handover.handoverAt).toLocaleString(),
              })}
            </Alert>
            <Button variant="contained" onClick={handleNewScan} fullWidth>
              {t("pda.handover.newScan")}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
