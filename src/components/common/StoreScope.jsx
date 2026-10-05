import React, { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import { StoreLocationContext } from "../../context/storeLocationContext";
import { listStores } from "../../helpers/store_api";
import {
  findNearbyStore,
  getCurrentCoordinates,
  STORE_RADIUS_METRES,
} from "../../helpers/store_location_helper";
import LoadingState from "./LoadingState";

const gpsErrorKey = (code) => {
  if (code === 1) return "storeLocation.permissionDenied";
  if (code === 3) return "storeLocation.timeout";
  if (code === "UNSUPPORTED") return "storeLocation.unsupported";
  return "storeLocation.unavailable";
};

export default function StoreScope({ children }) {
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  const { pathname } = useLocation();
  const companyId = pathname.startsWith("/tv") || pathname.startsWith("/m/")
    ? undefined
    : userInfo?.companyId;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    companyId,
    pathname,
    status: "locating",
    stores: [],
    store: null,
    source: null,
    errorKey: "",
    errorMessage: "",
    distance: null,
  });

  useEffect(() => {
    let active = true;
    const locate = async () => {
      let stores;
      try {
        const response = await listStores({ companyId, active: true });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : response.data;
        if (!Array.isArray(items)) throw new Error(t("storeLocation.invalidStores"));
        stores = items
          .filter((store) => (store.storeId || store.id) && store.active !== false)
          .map((store) => ({ ...store, storeId: String(store.storeId || store.id) }));
      } catch (error) {
        if (active) {
          setState({
            companyId, pathname, status: "error", stores: [], store: null, source: null,
            errorKey: "storeLocation.loadFailed",
            errorMessage: error.userMessage || error.response?.data?.message || error.message,
            distance: null,
          });
        }
        return;
      }
      if (!active) return;
      try {
        const position = await getCurrentCoordinates();
        if (!active) return;
        const nearby = findNearbyStore(stores, position);
        setState({
          companyId, pathname, status: "ready", stores,
          store: nearby?.store ?? null,
          source: nearby ? "gps" : null,
          distance: nearby?.distance ?? null,
          errorKey: nearby ? "" : "storeLocation.noNearby",
          errorMessage: "",
        });
      } catch (error) {
        if (!active) return;
        setState({
          companyId, pathname, status: "ready", stores, store: null, source: null,
          distance: null, errorKey: gpsErrorKey(error.code), errorMessage: "",
        });
      }
    };
    locate();
    return () => {
      active = false;
    };
  }, [companyId, pathname, attempt, t]);

  const retry = () => {
    setState({
      companyId, pathname, status: "locating", stores: [], store: null, source: null,
      errorKey: "", errorMessage: "", distance: null,
    });
    setAttempt((value) => value + 1);
  };

  if (state.companyId !== companyId || state.pathname !== pathname || state.status === "locating") {
    return <LoadingState message={t("storeLocation.locating")} />;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {state.errorKey && (
          <Alert severity={state.status === "error" ? "error" : "warning"}>
            {t(state.errorKey, { radius: STORE_RADIUS_METRES })}
            {state.errorMessage ? ` ${state.errorMessage}` : ""}
          </Alert>
        )}
        {state.source === "gps" ? (
          <Typography variant="body2" color="text.secondary">
            {t("storeLocation.detected", {
              store: state.store.storeName || state.store.storeId,
              distance: Math.round(state.distance),
            })}
          </Typography>
        ) : state.status !== "error" ? (
          <TextField
            select
            label={t("storeLocation.manualStore")}
            value={state.store?.storeId ?? ""}
            onChange={(event) => {
              const store = state.stores.find((item) => item.storeId === event.target.value);
              setState((current) => ({ ...current, store, source: "manual" }));
            }}
            helperText={t("storeLocation.manualHelp")}
            disabled={state.stores.length === 0}
            size="small"
            sx={{ maxWidth: 360 }}
          >
            {state.stores.map((store) => (
              <MenuItem key={store.storeId} value={store.storeId}>
                {store.storeName || store.storeId}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <Button onClick={retry} sx={{ alignSelf: "flex-start" }}>
          {t("storeLocation.retry")}
        </Button>
      </Box>
      {state.store && (
        <StoreLocationContext.Provider
          value={{ storeId: state.store.storeId, store: state.store, source: state.source }}
        >
          <React.Fragment key={state.store.storeId}>{children}</React.Fragment>
        </StoreLocationContext.Provider>
      )}
    </Box>
  );
}

StoreScope.propTypes = { children: PropTypes.node.isRequired };
