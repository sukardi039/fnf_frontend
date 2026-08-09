import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { fetchActiveProducts } from "../catalog/productApi";
import { LoadingState, EmptyState } from "../common";

export default function CustomerBrowse({ onAddToCart }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetchActiveProducts();
        if (!active) return;
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setProducts(items);
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message || t("customer.browse.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.productName, p.productCode, p.description].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [products, search]);

  const updateQuantity = (skuId, value) => {
    setQuantities((current) => ({ ...current, [skuId]: value }));
  };

  const handleAdd = (product) => {
    const quantity = Number(quantities[product.skuId]);
    if (!quantity || quantity <= 0) return;
    onAddToCart?.({
      skuId: product.skuId,
      productName: product.productName,
      uom: product.uom,
      quantity,
    });
    setQuantities((current) => ({ ...current, [product.skuId]: "" }));
  };

  if (loading) {
    return <LoadingState message={t("customer.browse.loading")} />;
  }

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        size="small"
        placeholder={t("customer.browse.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />

      {filteredProducts.length === 0 ? (
        <EmptyState
          title={t("customer.browse.noData")}
          description={
            search
              ? t("customer.browse.noSearchResults")
              : t("customer.browse.noDataDescription")
          }
        />
      ) : (
        <Grid container spacing={2}>
          {filteredProducts.map((product) => (
            <Grid item xs={12} sm={6} md={4} key={product.skuId}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {product.productName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {product.productCode}
                  </Typography>
                  {product.description && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {product.description}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {product.uom}
                  </Typography>
                </CardContent>
                <CardActions sx={{ gap: 1, px: 2, pb: 2 }}>
                  <TextField
                    type="number"
                    size="small"
                    placeholder={t("customer.browse.quantity")}
                    value={quantities[product.skuId] || ""}
                    onChange={(e) =>
                      updateQuantity(product.skuId, e.target.value)
                    }
                    inputProps={{ min: 0.001, step: "0.001" }}
                    sx={{ width: 100 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAdd(product)}
                  >
                    {t("customer.browse.add")}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

CustomerBrowse.propTypes = {
  onAddToCart: PropTypes.func,
};

CustomerBrowse.defaultProps = {
  onAddToCart: null,
};
