import React from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import {
  Person as PersonIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { request } from "../../helpers/axios_helper";
import { clearSessionCredentials } from "../../helpers/session_helper";

export default function PdaMe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = React.useState("");

  const session = (() => {
    try {
      return JSON.parse(localStorage.getItem("pda_user_info") || "{}");
    } catch {
      return {};
    }
  })();

  const staffName = session.staffName || "";
  const staffId = session.staffId || "";
  const deviceId = session.deviceId || "";

  const handleLogout = async () => {
    setError("");
    try {
      await request("POST", "/api/mobile-logins/logout", null, {
        skipAuthRedirect: true, skipBackendErrorDialog: true, sessionInterface: "PDA",
      });
    } catch (logoutError) {
      console.error("PDA server logout failed", logoutError);
    } finally {
      clearSessionCredentials("PDA");
      navigate("/login", { replace: true });
    }
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
          {t("pda.me.title", "Me")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t("pda.me.subtitle", "Signed-in PDA session")}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <List disablePadding>
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PersonIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={staffName || t("pda.me.unknownStaff", "Unknown staff")}
              secondary={t("pda.me.staffId", { staffId })}
            />
          </ListItem>
          <Divider component="li" />
          {deviceId && (
            <ListItem>
              <ListItemText
                primary={t("pda.me.deviceId", { deviceId })}
                secondary={t("pda.me.deviceLabel", "Device")}
              />
            </ListItem>
          )}
        </List>

        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          fullWidth
          sx={{ mt: 3, minHeight: 48 }}
          onClick={handleLogout}
        >
          {t("pda.nav.logout", "Logout")}
        </Button>
      </Paper>
    </Box>
  );
}
