import React, { useState } from "react";
import PropTypes from "prop-types";
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
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
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
  updateCustomerProfile,
  storeCustomerInfo,
} from "../../helpers/customer_helper";
import { countIncompleteCustomerOrders } from "../../helpers/customer_cart_helper";
import { currentSessionInterface } from "../../helpers/session_helper";

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
            ? { ...i, productPicture: item.productPicture ?? i.productPicture,
              quantity: Number(i.quantity) + Number(item.quantity) }
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

function CustomerProfile({ customer, onProfileUpdated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    mobileNumber: customer?.mobileNumber || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSaved(false);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const profile = {
      name: form.name.trim(),
      email: form.email.trim(),
      mobileNumber: form.mobileNumber.trim(),
    };
    try {
      const response = await updateCustomerProfile(customer.customerId, profile);
      const responseProfile = response?.data?.customer || response?.data || {};
      const updatedCustomer = {
        ...customer,
        name: responseProfile.name ?? profile.name,
        email: responseProfile.email ?? profile.email,
        mobileNumber: responseProfile.mobileNumber ?? profile.mobileNumber,
      };
      storeCustomerInfo(updatedCustomer);
      onProfileUpdated(updatedCustomer);
      setForm({
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        mobileNumber: updatedCustomer.mobileNumber,
      });
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.message || t("customer.profile.updateFailed", "Unable to update profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h6" component="h1">
          {t("customer.profile.title", "Profile")}
        </Typography>
        {customer && !editing && (
          <Button
            variant="outlined"
            onClick={() => setEditing(true)}
            sx={{ minHeight: 44, flexShrink: 0 }}
          >
            {t("customer.profile.edit", "Edit")}
          </Button>
        )}
      </Stack>
      {customer ? (
        <>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {saved && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {t("customer.profile.updateSuccess", "Profile updated.")}
            </Alert>
          )}
          {editing ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2, maxWidth: 480 }}>
              <TextField
                label={t("customer.profile.name", "Full name")}
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label={t("customer.profile.email", "Email")}
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label={t("customer.profile.mobileNumber", "Mobile number")}
                name="mobileNumber"
                value={form.mobileNumber}
                onChange={handleChange}
                fullWidth
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button type="submit" variant="contained" disabled={saving} sx={{ minHeight: 44 }}>
                  {saving
                    ? t("common.saving", "Saving...")
                    : t("customer.profile.save", "Save changes")}
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  sx={{ minHeight: 44 }}
                  onClick={() => {
                    setForm({
                      name: customer.name || "",
                      email: customer.email || "",
                      mobileNumber: customer.mobileNumber || "",
                    });
                    setError("");
                    setEditing(false);
                  }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
              <Typography variant="body1">{customer.name}</Typography>
              <Typography variant="body2" color="text.secondary">{customer.email}</Typography>
              {customer.mobileNumber && (
                <Typography variant="body2" color="text.secondary">{customer.mobileNumber}</Typography>
              )}
            </Box>
          )}
          <Accordion sx={{ mt: 3 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="profile-aborted-orders-panel"
              id="profile-aborted-orders-heading"
            >
              <Typography component="h2">
                {t("customer.profile.abortedOrders", "Expired or aborted orders")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails id="profile-aborted-orders-panel">
              <CustomerOrders showAbortedOrders />
            </AccordionDetails>
          </Accordion>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("customer.profile.notSignedIn", "Not signed in")}
        </Typography>
      )}
    </Box>
  );
}
CustomerProfile.propTypes = {
  customer: PropTypes.shape({
    customerId: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    mobileNumber: PropTypes.string,
  }),
  onProfileUpdated: PropTypes.func.isRequired,
};

export default function CustomerShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(() => getCustomerInfo());
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [orderCount, setOrderCount] = useState(null);
  const [orderCountError, setOrderCountError] = useState(false);
  const { items, addItem, removeItem, updateQuantity, clearCart } =
    useCartState();

  React.useEffect(() => {
    const onExpired = (event) => {
      if (event.detail.interface !== "MOBILE") return;
      setCustomer(null);
      setOrderCount(null);
      setOrderCountError(false);
      setAuthError(t("auth.sessionExpired"));
      if (currentSessionInterface() === "MOBILE") {
        event.detail.handled = true;
        navigate("/m/auth", { replace: true });
      }
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [navigate, t]);

  React.useEffect(() => {
    let active = true;
    let running = false;
    if (!customer) return;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const count = await countIncompleteCustomerOrders(customer.customerId);
        if (active) {
          setOrderCount(count);
          setOrderCountError(false);
        }
      } catch {
        if (active) {
          setOrderCount(null);
          setOrderCountError(true);
        }
      } finally {
        running = false;
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("customer:orders:refresh", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("customer:orders:refresh", refresh);
    };
  }, [customer, location.pathname, items.length]);

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
    setOrderCount(null);
    setOrderCountError(false);
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
      <AppBar position="static" color="default" elevation={0}
        sx={{ bgcolor: "background.paper", color: "text.primary", borderRadius: 0 }}>
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
        {orderCountError && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
            {t("customer.orders.badgeLoadFailed", "Unable to update the incomplete order count.")}
          </Alert>
        )}
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
            element={
              <StoreScope>
                <CustomerBrowse onAddToCart={addItem} />
              </StoreScope>
            }
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
          <Route
            path="/profile"
            element={
              <CustomerProfile
                customer={customer}
                onProfileUpdated={setCustomer}
              />
            }
          />
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
            icon={
              items.length > 0 ? (
                <Badge
                  badgeContent={items.length}
                  color="error"
                  max={Number.MAX_SAFE_INTEGER}
                >
                  <CartIcon />
                </Badge>
              ) : (
                <CartIcon />
              )
            }
          />
          <BottomNavigationAction
            label={t("customer.menu.orders", "Orders")}
            icon={orderCount > 0 ? (
              <Badge badgeContent={orderCount} color="error" max={Number.MAX_SAFE_INTEGER}>
                <OrdersIcon />
              </Badge>
            ) : <OrdersIcon />}
          />
          <BottomNavigationAction
            label={t("customer.menu.me", "Me")}
            icon={<ProfileIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
