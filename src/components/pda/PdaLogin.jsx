import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { request, setAuthHeader } from "../../helpers/axios_helper";
import { clearSessionCredentials } from "../../helpers/session_helper";

export default function PdaLogin() {
  const [searchParams] = useSearchParams();
  const loginKey = searchParams.get("loginkey") || "";
  return <PdaLoginAttempt key={loginKey} loginKey={loginKey} />;
}

function PdaLoginAttempt({ loginKey }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const exchange = useRef(null);
  const [error, setError] = useState("");
  const [expiredLinkError, setExpiredLinkError] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const resolveLoginError = (err) => {
    const status = err?.response?.status;
    const backendMessage = String(err?.response?.data?.message || "").trim();
    const axiosMessage = String(err?.message || "").trim();
    const combined = `${backendMessage} ${axiosMessage}`.toLowerCase();

    if (status === 401 || status === 403 || status === 410) {
      return {
        message: t(
          "pda.login.expired",
          "This PDA login link is expired or invalid. Please scan a new QR code.",
        ),
        isExpired: true,
      };
    }

    if (
      combined.includes("expired") ||
      combined.includes("invalid") ||
      combined.includes("unauthorized")
    ) {
      return {
        message: t(
          "pda.login.expired",
          "This PDA login link is expired or invalid. Please scan a new QR code.",
        ),
        isExpired: true,
      };
    }

    return {
      message: backendMessage || axiosMessage || t("pda.login.failed"),
      isExpired: false,
    };
  };

  const handleDismissExpired = async () => {
    setDismissing(true);
    clearSessionCredentials("PDA");

    await Promise.allSettled([
      request("POST", "/api/mobile-logins/logout", null, {
        skipAuthRedirect: true,
        sessionInterface: "PDA",
      }),
    ]);

    if (typeof window !== "undefined") {
      window.location.href = window.location.origin;
      return;
    }
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!loginKey) return;
    let active = true;
    // QR challenges are one-use; effect replays must subscribe to the same exchange.
    if (!exchange.current) {
      exchange.current = request("POST", "/api/mobile-logins/login", { loginKey }, {
        skipAuthRedirect: true, skipBackendErrorDialog: true, sessionInterface: "PDA",
      });
    }
    exchange.current
      .then((response) => {
        if (!active) return;
        const token = response.data.token;
        setAuthHeader(token, "PDA");
        const userData = response.data;
        localStorage.setItem("pda_user_info", JSON.stringify(userData));
        navigate("/pda/home", { replace: true });
      })
      .catch((err) => {
        if (!active) return;
        const { message, isExpired } = resolveLoginError(err);
        setExpiredLinkError(isExpired);
        const msg = message;
        setError(msg);
      });
    return () => { active = false; };
  }, [navigate, loginKey, t]);

  if (error || !loginKey) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 480, width: "100%" }}>
          <Typography variant="body1">{error || t("pda.login.signInAgain")}</Typography>
        </Alert>
        {!loginKey && (
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate("/login", { replace: true })}>
            {t("pda.login.openLogin")}
          </Button>
        )}
        {expiredLinkError && (
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={handleDismissExpired}
            disabled={dismissing}
          >
            {dismissing
              ? t("auth.signingIn", "Signing in...")
              : t("pda.session.dismiss", "Dismiss")}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

PdaLoginAttempt.propTypes = { loginKey: PropTypes.string.isRequired };
