import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function StockViewPlaceholder() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Typography variant="h6" align="center" color="text.secondary">
        {t("common.comingSoon", "This feature is coming soon.")}
      </Typography>
    </Box>
  );
}
