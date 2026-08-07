import React from "react";
import { Box, Paper, useTheme, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

const loginLogoSrc = "/fNf.png";

const AuthLayout = ({ children }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        backgroundImage:
          "linear-gradient(140deg, #effee9 0%, #d6f8cc 38%, #ffeecf 100%)",
        position: "relative",
        overflow: "hidden",
        p: 2,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          "&::before": {
            content: '""',
            position: "absolute",
            width: { xs: 220, md: 340 },
            height: { xs: 220, md: 340 },
            borderRadius: "50%",
            top: { xs: -70, md: -90 },
            right: { xs: -50, md: -70 },
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,173,66,0.48), rgba(255,173,66,0.08) 70%)",
            animation: "floatOrbOne 8s ease-in-out infinite",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: { xs: 180, md: 260 },
            height: { xs: 180, md: 260 },
            borderRadius: "50%",
            bottom: { xs: -70, md: -90 },
            left: { xs: -55, md: -80 },
            background:
              "radial-gradient(circle at 50% 50%, rgba(78,188,96,0.45), rgba(78,188,96,0.08) 72%)",
            animation: "floatOrbTwo 9s ease-in-out infinite",
          },
          "@keyframes floatOrbOne": {
            "0%, 100%": { transform: "translateY(0px)" },
            "50%": { transform: "translateY(12px)" },
          },
          "@keyframes floatOrbTwo": {
            "0%, 100%": { transform: "translateY(0px)" },
            "50%": { transform: "translateY(-12px)" },
          },
        }}
      />

      {/* Language Switcher - Top Right */}
      <Box
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 2,
        }}
      >
        <LanguageSwitcher />
      </Box>

      {/* Top banner removed per request */}

      {/* Auth Content Card */}
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          maxWidth: 450,
          p: { xs: 3, sm: 4 },
          borderRadius: 5,
          bgcolor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(57, 167, 74, 0.2)",
          position: "relative",
          zIndex: 1,
          boxShadow: "0 18px 42px rgba(42, 95, 55, 0.22)",
          animation: "cardReveal 0.55s ease-out",
          "@keyframes cardReveal": {
            from: { opacity: 0, transform: "translateY(14px) scale(0.98)" },
            to: { opacity: 1, transform: "translateY(0) scale(1)" },
          },
        }}
      >
        {/* Small header / hero inside the card (also removable) */}
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Box sx={{ display: "inline-block", mb: 1 }}>
            <Box
              component="img"
              src={loginLogoSrc}
              alt={t("auth.appTitle")}
              sx={{
                width: "34%",
                height: "auto",
                objectFit: "contain",
                display: "block",
                mx: "auto",
                filter: "drop-shadow(0 10px 16px rgba(51, 126, 71, 0.25))",
              }}
            />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t("auth.appTitle")}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {t("auth.appSubtitle")}
          </Typography>
        </Box>

        {children}
      </Paper>

      {/* Footer */}
      <Box
        sx={{
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(24, 62, 44, 0.7)",
          fontSize: "0.875rem",
          zIndex: 1,
        }}
      >
        {t("auth.footer", { year: new Date().getFullYear() })}
      </Box>
    </Box>
  );
};

export default AuthLayout;
