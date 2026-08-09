import React from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import EmptyState from "./EmptyState";

const PlaceholderPage = ({ titleKey, descriptionKey, icon }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ py: 4 }}>
      <EmptyState
        icon={icon}
        title={t(titleKey || "placeholder.title")}
        description={t(descriptionKey || "placeholder.description")}
      />
    </Box>
  );
};

export default PlaceholderPage;
