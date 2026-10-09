import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { issueCustomerArrivalToken, issueCustomerCollectionToken } from "../../helpers/pickup_helper";

export default function CollectionToken({ transactionId, purpose = "collection" }) {
  return <OrderToken key={`${transactionId}-${purpose}`} transactionId={transactionId} purpose={purpose} />;
}

function OrderToken({ transactionId, purpose }) {
  const { t } = useTranslation();
  const prefix = purpose === "arrival" ? "arrival" : "collection";
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const active = useRef(true);
  const requesting = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (!token) return undefined;
    const timer = setTimeout(() => {
      setToken(null);
      setExpired(true);
    }, Math.max(0, Date.parse(token.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [token]);

  const issue = async () => {
    if (requesting.current) return;
    requesting.current = true;
    setBusy(true);
    setError("");
    setToken(null);
    try {
      const issueToken = purpose === "arrival" ? issueCustomerArrivalToken : issueCustomerCollectionToken;
      const { data } = await issueToken(transactionId);
      if (data?.transactionId !== transactionId || typeof data.qrToken !== "string" ||
          (purpose === "arrival" && data.purpose !== "ARRIVAL") ||
          !data.qrToken.trim() || data.qrToken.length > 2048 ||
          !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) {
        throw new Error(t(`${prefix}.invalidResponse`));
      }
      if (active.current) {
        setToken(data);
        setExpired(false);
      }
    } catch (requestError) {
      if (active.current) setError(
        requestError?.response?.data?.message || requestError?.message || t(`${prefix}.failed`),
      );
    } finally {
      requesting.current = false;
      if (active.current) setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {expired && <Alert severity="warning" sx={{ mb: 1 }}>{t(`${prefix}.expired`)}</Alert>}
      <Button onClick={issue} disabled={busy}>{t(`${prefix}.${busy ? "loading" : "show"}`)}</Button>
      {token && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ mb: 1 }}>{t(`${prefix}.present`)}</Typography>
          <QRCodeSVG
            value={token.qrToken} size={220} level="M" marginSize={4}
            role="img" aria-label={t(`${prefix}.qrLabel`)}
          />
          {purpose === "collection" && (
            <TextField
              label={t(`${prefix}.token`)} value={token.qrToken} multiline fullWidth
              slotProps={{ input: { readOnly: true } }} sx={{ mt: 1 }}
            />
          )}
          <Typography variant="body2" sx={{ mt: 1 }}>
            {t("collection.expiresAt", { date: new Date(token.expiresAt).toLocaleString() })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

CollectionToken.propTypes = {
  transactionId: PropTypes.string.isRequired,
  purpose: PropTypes.oneOf(["collection", "arrival"]),
};
OrderToken.propTypes = {
  transactionId: PropTypes.string.isRequired,
  purpose: PropTypes.oneOf(["collection", "arrival"]).isRequired,
};
