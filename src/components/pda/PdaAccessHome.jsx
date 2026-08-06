import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function PdaAccessHome() {
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
        sx={{ p: 4, maxWidth: 560, width: "100%", textAlign: "center" }}
        elevation={2}
      >
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          {t("pda.access.title", "PDA Access Ready")}
        </Typography>
        <Typography color="text.secondary">
          {t(
            "pda.access.description",
            "This starter framework keeps PDA authentication access. Add your project-specific PDA modules in the new system.",
          )}
        </Typography>
      </Paper>
    </Box>
  );
}
