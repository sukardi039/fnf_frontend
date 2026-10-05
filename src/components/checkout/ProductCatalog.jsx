import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Inventory2 as InventoryIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { fetchActiveProducts } from "../catalog/productApi";
import { EmptyState, LoadingState } from "../common";
import { getDisplayImageInfo, ThumbnailImg } from "../../helpers/file_helper";

function ProductPicture({ picture, alt }) {
  const imageInfo = picture ? getDisplayImageInfo(picture) : null;
  let imageUrl = imageInfo?.imageUrl || null;
  if (!imageUrl && typeof picture === "string") {
    const value = picture.trim();
    if (value.startsWith("data:")) imageUrl = value;
    else if (/^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 100) {
      imageUrl = `data:image/png;base64,${value}`;
    }
  }
  const imageMeta = imageInfo?.meta;

  return (
    <Box
      sx={{
        position: "relative",
        width: "auto",
        height: "auto",
        minWidth: 0,
        minHeight: 0,
        m: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        bgcolor: "background.default",
        color: "text.secondary",
        borderRadius: 1,
      }}
    >
      <InventoryIcon sx={{ fontSize: 28 }} />
      {imageMeta?.id ? (
        <Box sx={{ position: "absolute", inset: 0 }}>
          <ThumbnailImg
            fileId={imageMeta.id}
            viewUrl={imageMeta.viewUrl || ""}
            provider={imageMeta.provider || null}
            width={240}
            height={180}
            alt={alt}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </Box>
      ) : imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : null}
    </Box>
  );
}

ProductPicture.propTypes = {
  picture: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
    PropTypes.array,
  ]),
  alt: PropTypes.string,
};

export default function ProductCatalog({ onAddToCart, disabled = false }) {
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
      setError("");
      try {
        const response = await fetchActiveProducts();
        if (!active) return;
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setProducts(items);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            t("customer.browse.loadFailed"),
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
    return products.filter((product) =>
      [product.productName, product.productCode, product.description].some(
        (value) => String(value || "").toLowerCase().includes(term),
      ),
    );
  }, [products, search]);

  const addProduct = (product) => {
    const quantity = Number(quantities[product.skuId]);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    onAddToCart?.({
      skuId: product.skuId,
      productName: product.productName,
      uom: product.uom,
      quantity,
    });
    setQuantities((current) => ({ ...current, [product.skuId]: "" }));
  };

  if (loading) return <LoadingState message={t("customer.browse.loading")} />;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField
        fullWidth
        size="small"
        label={t("customer.browse.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
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
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {filteredProducts.map((product) => (
            <Box key={product.skuId}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                  overflow: "hidden",
                }}
              >
                <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" gutterBottom>
                        {product.productName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.productCode}
                      </Typography>
                    </Box>
                    {product.description && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {product.description}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {product.uom}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ gap: 1, px: 2, pb: 2, flexWrap: "wrap" }}>
                    <TextField
                      type="number"
                      size="small"
                      label={t("customer.browse.quantity")}
                      value={quantities[product.skuId] || ""}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [product.skuId]: event.target.value,
                        }))
                      }
                      inputProps={{ min: 0.001, step: "0.001" }}
                      disabled={disabled}
                      sx={{ width: 110 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => addProduct(product)}
                      disabled={disabled}
                    >
                      {t("customer.browse.add")}
                    </Button>
                  </CardActions>
                </Box>
                <ProductPicture
                  picture={product.productPicture}
                  alt={product.productName || ""}
                />
              </Card>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

ProductCatalog.propTypes = {
  onAddToCart: PropTypes.func,
  disabled: PropTypes.bool,
};
