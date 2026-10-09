import React, { useContext, useEffect, useState } from "react";
import { Box, Grid, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../context/authContext";
import { useStoreLocation } from "../context/storeLocationContext";
import DiscountCard from "./dashboard/DiscountCard";
import SalesCard from "./dashboard/SalesCard";
import InventoryCard from "./dashboard/InventoryCard";
import { toLocalDate } from "../helpers/date_helper";

const formatDateTime = (date, locale) =>
  date.toLocaleString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const AppHome = () => {
  const { t, i18n } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  const { storeId } = useStoreLocation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayIso = toLocalDate(now);

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {t("dashboard.welcome")}
            {userInfo?.firstName ? `, ${userInfo.firstName}` : ""}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t("dashboard.subtitle")}
          </Typography>
        </Box>
        <Typography
          variant="h6"
          fontWeight={600}
          color="primary.main"
          sx={{ whiteSpace: "nowrap" }}
        >
          {formatDateTime(now, i18n.language)}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DiscountCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <SalesCard date={todayIso} storeId={storeId} />
        </Grid>
        <Grid item xs={12} md={6}>
          <InventoryCard storeId={storeId} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AppHome;
