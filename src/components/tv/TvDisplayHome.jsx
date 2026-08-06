import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function TvDisplayHome() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        sx={{ p: 4, maxWidth: 640, width: "100%", textAlign: "center" }}
        elevation={2}
      >
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          {t("tv.display.title", "TV Display Access Ready")}
        </Typography>
        <Typography color="text.secondary">
          {t(
            "tv.display.description",
            "TV authentication and session exchange are active in this base framework. Build your project-specific display pages on top of this route.",
          )}
        </Typography>
      </Paper>
    </Box>
  );
}
