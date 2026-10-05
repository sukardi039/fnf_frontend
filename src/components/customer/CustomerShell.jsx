import React, { useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  Storefront as BrowseIcon,
  ShoppingCart as CartIcon,
  ListAlt as OrdersIcon,
  Person as ProfileIcon,
} from "@mui/icons-material";
import CustomerAuth from "./CustomerAuth";
import CustomerBrowse from "./CustomerBrowse";
import CustomerCart from "./CustomerCart";
import CustomerOrders from "./CustomerOrders";
import StoreScope from "../common/StoreScope";
import {
  registerCustomer,
  loginCustomer,
  storeCustomerSession,
  clearCustomerSession,
  getCustomerInfo,
} from "../../helpers/customer_helper";

function CustomerComingSoon() {
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
        {t("customer.comingSoon", "Customer mobile experience is coming soon.")}
      </Typography>
    </Box>
  );
}

function useCartState() {
  const [items, setItems] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem("customer_cart");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    sessionStorage.setItem("customer_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item) => {
    setItems((current) => {
      const existing = current.find((i) => i.skuId === item.skuId);
      if (existing) {
        return current.map((i) =>
          i.skuId === item.skuId
            ? { ...i, quantity: Number(i.quantity) + Number(item.quantity) }
            : i,
        );
      }
      return [...current, item];
    });
  };

  const removeItem = (skuId) => {
    setItems((current) => current.filter((i) => i.skuId !== skuId));
  };

  const updateQuantity = (skuId, quantity) => {
    const value = Number(quantity);
    if (!value || value <= 0) {
      removeItem(skuId);
      return;
    }
    setItems((current) =>
      current.map((i) => (i.skuId === skuId ? { ...i, quantity: value } : i)),
    );
  };

  const clearCart = () => setItems([]);

  return { items, addItem, removeItem, updateQuantity, clearCart };
}

function CustomerProfile() {
  const { t } = useTranslation();
  const customer = getCustomerInfo();
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("customer.profile.title", "Profile")}
      </Typography>
      {customer ? (
        <>
          <Typography variant="body1">{customer.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {customer.email}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("customer.profile.notSignedIn", "Not signed in")}
        </Typography>
      )}
    </Box>
  );
}

export default function CustomerShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(() => getCustomerInfo());
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const { items, addItem, removeItem, updateQuantity, clearCart } =
    useCartState();

  const handleRegister = async (data) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await registerCustomer(data);
      storeCustomerSession(response);
      setCustomer(getCustomerInfo());
      navigate("/m/browse", { replace: true });
    } catch (err) {
      setAuthError(
        err?.response?.data?.message || t("customerAuth.registerFailed"),
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (data) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await loginCustomer(data);
      storeCustomerSession(response);
      setCustomer(getCustomerInfo());
      navigate("/m/browse", { replace: true });
    } catch (err) {
      setAuthError(
        err?.response?.data?.message || t("customerAuth.loginFailed"),
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearCustomerSession();
    setCustomer(null);
    navigate("/m/auth", { replace: true });
  };

  if (!customer && location.pathname !== "/m/auth") {
    return (
      <CustomerAuth
        onRegister={handleRegister}
        onLogin={handleLogin}
        error={authError}
        loading={authLoading}
      />
    );
  }

  const pathToIndex = {
    "/m/browse": 0,
    "/m/cart": 1,
    "/m/orders": 2,
    "/m/profile": 3,
  };
  const tabValue = pathToIndex[location.pathname] ?? 0;

  return (
    <Box sx={{ pb: 8, minHeight: "100vh" }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {t("app.title", "Fresh And Fresh")}
          </Typography>
          {customer && (
            <Button color="inherit" onClick={handleLogout} size="small">
              {t("customerAuth.logout", "Logout")}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ pt: 2 }}>
        <Routes>
          <Route
            path="/auth"
            element={
              <CustomerAuth
                onRegister={handleRegister}
                onLogin={handleLogin}
                error={authError}
                loading={authLoading}
              />
            }
          />
          <Route
            path="/browse"
            element={<CustomerBrowse onAddToCart={addItem} />}
          />
          <Route
            path="/cart"
            element={
              <StoreScope>
                <CustomerCart
                  items={items}
                  onClear={clearCart}
                  onRemove={removeItem}
                  onUpdateQuantity={updateQuantity}
                />
              </StoreScope>
            }
          />
          <Route path="/orders" element={<CustomerOrders />} />
          <Route path="/profile" element={<CustomerProfile />} />
          <Route path="/" element={<Navigate to="/m/browse" replace />} />
          <Route path="/*" element={<CustomerComingSoon />} />
        </Routes>
      </Box>

      <Paper
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1300 }}
        elevation={3}
      >
        <BottomNavigation
          showLabels
          value={tabValue}
          onChange={(event, newValue) => {
            const paths = ["/m/browse", "/m/cart", "/m/orders", "/m/profile"];
            navigate(paths[newValue], { replace: true });
          }}
        >
          <BottomNavigationAction
            label={t("customer.menu.browse", "Browse")}
            icon={<BrowseIcon />}
          />
          <BottomNavigationAction
            label={t("customer.menu.cart", "Cart")}
            icon={<CartIcon />}
          />
          <BottomNavigationAction
            label={t("customer.menu.orders", "Orders")}
            icon={<OrdersIcon />}
          />
          <BottomNavigationAction
            label={t("customer.menu.profile", "Profile")}
            icon={<ProfileIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
