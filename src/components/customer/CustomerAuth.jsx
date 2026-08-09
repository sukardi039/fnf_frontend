import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Divider,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

export default function CustomerAuth({ onRegister, onLogin, error, loading }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (tab === 0) {
      onRegister({
        name: form.name.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        password: form.password,
      });
    } else {
      onLogin({ email: form.email.trim(), password: form.password });
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", mt: 4, px: 2 }}>
      <Typography variant="h5" fontWeight={700} align="center" gutterBottom>
        {t("app.title", "Fresh And Fresh")}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        align="center"
        sx={{ mb: 3 }}
      >
        {t("customerAuth.subtitle", "Create an account or sign in to order")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, newValue) => setTab(newValue)}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab label={t("customerAuth.register", "Register")} />
        <Tab label={t("customerAuth.login", "Login")} />
      </Tabs>

      <Box component="form" onSubmit={handleSubmit}>
        {tab === 0 && (
          <TextField
            label={t("customerAuth.name", "Full name")}
            name="name"
            value={form.name}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
        )}
        <TextField
          label={t("customerAuth.email", "Email")}
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          fullWidth
          margin="normal"
          required
        />
        {tab === 0 && (
          <TextField
            label={t("customerAuth.mobile", "Mobile number (optional)")}
            name="mobileNumber"
            value={form.mobileNumber}
            onChange={handleChange}
            fullWidth
            margin="normal"
          />
        )}
        <TextField
          label={t("customerAuth.password", "Password")}
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          fullWidth
          margin="normal"
          required
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{ mt: 2, mb: 2 }}
        >
          {loading
            ? t("common.loading", "Loading...")
            : tab === 0
              ? t("customerAuth.register", "Register")
              : t("customerAuth.login", "Login")}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        align="center"
      >
        {t(
          "customerAuth.legalHint",
          "By continuing, you agree to our terms and privacy policy.",
        )}
      </Typography>
    </Box>
  );
}

CustomerAuth.propTypes = {
  onRegister: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
  error: PropTypes.string,
  loading: PropTypes.bool,
};
