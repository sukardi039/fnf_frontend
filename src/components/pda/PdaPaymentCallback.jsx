import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useStoreLocation } from "../../context/storeLocationContext";
import {
  clearPdaPayment,
  readPdaPaymentConfirmation,
  readPdaPaymentContext,
} from "../../helpers/pda_payment_helper";
import { confirmPickupElectronicPayment } from "../../helpers/pickup_helper";
import { pickupErrorMessage, validatePickupOrder } from "../pickup/pickupUtils";

export default function PdaPaymentCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { storeId } = useStoreLocation();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (submitting.current) return undefined;
    let active = true;
    submitting.current = true;
    const submit = async () => {
      try {
        const context = readPdaPaymentContext();
        if (context.storeId !== storeId) throw new Error("pdaPayment.confirmationMismatch");
        const confirmation = readPdaPaymentConfirmation(searchParams.toString());
        const { data } = await confirmPickupElectronicPayment(
          context.transactionId,
          context.storeId,
          confirmation,
          crypto.randomUUID(),
        );
        validatePickupOrder(data, context.storeId, context.transactionId);
        if (data.paymentStatus !== "SUCCESS") throw new Error("pdaPayment.notRecorded");
        clearPdaPayment();
        if (active) {
          navigate(`/pda/pickup?transactionId=${encodeURIComponent(context.transactionId)}`, { replace: true });
        }
      } catch (requestError) {
        if (active) {
          setError(requestError?.message?.startsWith("pdaPayment.")
            ? t(requestError.message)
            : pickupErrorMessage(requestError, t));
          submitting.current = false;
        }
      }
    };
    submit();
    return () => { active = false; };
  }, [attempt, navigate, searchParams, storeId, t]);

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", p: 2, textAlign: "center" }}>
      {error ? (
        <>
          <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>{error}</Alert>
          <Button variant="outlined" onClick={() => navigate("/pda/pickup", { replace: true })}>
            {t("pda.payment.backToPickup", "Back to pickup orders")}
          </Button>
          <Button sx={{ ml: 1 }} onClick={() => setAttempt((value) => value + 1)}>
            {t("pickup.refresh", "Retry")}
          </Button>
        </>
      ) : (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>{t("pda.payment.recording", "Recording the payment confirmation...")}</Typography>
        </>
      )}
    </Box>
  );
}
