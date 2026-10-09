import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Inventory2 as InventoryIcon,
  PhotoCamera as PhotoCameraIcon,
  Undo as UndoIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  fetchActiveProducts,
  matchProductsByImage,
} from "../catalog/productApi";
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

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const getQuantityStep = (uom) =>
  ["kg", "l"].includes(String(uom || "").trim().toLowerCase()) ? "0.1" : "1";

export default function ProductCatalog({
  onAddToCart,
  disabled = false,
  enablePhotoSearch = true,
  storeId = "",
}) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState({});
  const [photo, setPhoto] = useState(null);
  const photoInputRef = useRef(null);
  const photoRequestId = useRef(0);
  const [photoMatches, setPhotoMatches] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [matchingPhoto, setMatchingPhoto] = useState(false);

  useEffect(() => {
    return () => {
      photoRequestId.current += 1;
    };
  }, []);

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
    const availableProducts = photoMatches ?? products;
    if (!term) return availableProducts;
    return availableProducts.filter((product) =>
      [product.productName, product.productCode, product.description].some(
        (value) => String(value || "").toLowerCase().includes(term),
      ),
    );
  }, [photoMatches, products, search]);

  const clearPhotoSearch = () => {
    photoRequestId.current += 1;
    setPhoto(null);
    setPhotoMatches(null);
    setPhotoError("");
    setMatchingPhoto(false);
  };

  const matchPhoto = async (selectedPhoto) => {
    const requestId = photoRequestId.current + 1;
    photoRequestId.current = requestId;
    setMatchingPhoto(true);
    setPhotoError("");
    try {
      const response = await matchProductsByImage(selectedPhoto, storeId);
      const matches = response.data?.matches;
      if (
        !Array.isArray(matches) ||
        matches.some(
          (match) =>
            !match ||
            typeof match.skuId !== "string" ||
            typeof match.productName !== "string",
        )
      ) {
        throw new Error(t("customer.browse.photoInvalidResponse"));
      }
      if (photoRequestId.current === requestId) {
        setPhotoMatches(matches.slice(0, 5));
      }
    } catch (requestError) {
      if (photoRequestId.current === requestId) {
        setPhotoError(
          requestError?.response?.data?.message ||
            requestError.message ||
            t("customer.browse.photoMatchFailed"),
        );
        setPhotoMatches(null);
      }
    } finally {
      if (photoRequestId.current === requestId) setMatchingPhoto(false);
    }
  };

  const handlePhotoSelected = (event) => {
    const selectedPhoto = event.target.files?.[0] || null;
    event.target.value = "";
    if (!selectedPhoto) return;
    if (!SUPPORTED_PHOTO_TYPES.includes(selectedPhoto.type)) {
      setPhotoError(t("customer.browse.photoUnsupported"));
      return;
    }
    if (selectedPhoto.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError(t("customer.browse.photoTooLarge"));
      return;
    }
    if (!storeId) {
      setPhotoError(t("customer.browse.photoStoreRequired"));
      return;
    }
    setPhoto(selectedPhoto);
    setPhotoMatches(null);
    setPhotoError("");
    matchPhoto(selectedPhoto);
  };

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
        InputProps={{
          endAdornment: enablePhotoSearch ? (
            <InputAdornment position="end">
              <IconButton
                aria-label={t(photo
                  ? "customer.browse.clearPhoto"
                  : "customer.browse.photoSearchAction")}
                onClick={() => {
                  if (photo) clearPhotoSearch();
                  else photoInputRef.current?.click();
                }}
                disabled={disabled || (!photo && !storeId)}
                edge="end"
              >
                {photo ? <UndoIcon /> : <PhotoCameraIcon />}
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
        sx={{ mb: 2 }}
      />
      {enablePhotoSearch && (
        <input
          hidden
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handlePhotoSelected}
        />
      )}
      {enablePhotoSearch && (photo || photoError) && (
        <Box sx={{ mb: 2 }}>
          {photo && matchingPhoto && (
            <Alert severity="info">
              {t("customer.browse.matchingPhoto")}
            </Alert>
          )}
          {photoError && (
            <Alert severity="error">
              {photoError}
            </Alert>
          )}
        </Box>
      )}
      {photoMatches !== null && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("customer.browse.photoMatchHint")}
        </Alert>
      )}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title={t(photoMatches !== null
            ? "customer.browse.noPhotoMatches"
            : "customer.browse.noData")}
          description={
            photoMatches !== null
              ? t("customer.browse.noPhotoMatchesDescription")
              : search
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
                      inputProps={{ min: 0, step: getQuantityStep(product.uom) }}
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
  enablePhotoSearch: PropTypes.bool,
  storeId: PropTypes.string,
};
