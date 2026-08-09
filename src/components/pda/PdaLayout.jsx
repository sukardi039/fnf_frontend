import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  QrCodeScanner as ScanIcon,
  Person as MeIcon,
  ShoppingCart as CheckoutIcon,
} from "@mui/icons-material";

export default function PdaLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const tabValue = location.pathname.startsWith("/pda/me")
    ? 2
    : location.pathname.startsWith("/pda/checkout")
      ? 1
      : 0;

  return (
    <Box sx={{ pb: 8, minHeight: "100vh" }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {t("pda.handover.title", "PDA")}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ pt: 2 }}>
        <Outlet />
      </Box>

      <Paper
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1300 }}
        elevation={3}
      >
        <BottomNavigation
          showLabels
          value={tabValue}
          onChange={(event, newValue) => {
            if (newValue === 0) {
              navigate("/pda/home", { replace: true });
            } else if (newValue === 1) {
              navigate("/pda/checkout", { replace: true });
            } else if (newValue === 2) {
              navigate("/pda/me", { replace: true });
            }
          }}
        >
          <BottomNavigationAction
            label={t("pda.nav.verifyCollection", "Verify")}
            icon={<ScanIcon />}
          />
          <BottomNavigationAction
            label={t("pda.nav.assistedCheckout", "Checkout")}
            icon={<CheckoutIcon />}
          />
          <BottomNavigationAction
            label={t("pda.nav.logout", "Me")}
            icon={<MeIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
