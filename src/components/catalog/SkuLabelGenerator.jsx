import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import {
  Download as DownloadIcon,
  QrCode2 as QrCodeIcon,
} from "@mui/icons-material";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { request } from "../../helpers/axios_helper";

const OUTPUT_FORMATS = ["PNG", "PDF"];

const SkuLabelGenerator = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [skuId, setSkuId] = useState("");
  const [outputFormat, setOutputFormat] = useState("PNG");
  const [error, setError] = useState("");
  const [label, setLabel] = useState(null);

  useEffect(() => {
    let active = true;

    request("GET", "/api/products?active=true", null, {
      skipAuthRedirect: true,
      skipBackendErrorDialog: true,
    })
      .then((response) => {
        if (!active) return;
        setProducts(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      })
      .catch(() => {
        if (active) setError(t("skuLabel.productsUnavailable"));
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!skuId) {
      setError(t("skuLabel.skuRequired"));
      return;
    }

    setGenerating(true);
    setError("");
    setLabel(null);
    try {
      const response = await request(
        "POST",
        "/api/labels",
        { skuId, outputFormat },
        { skipAuthRedirect: true, skipBackendErrorDialog: true },
      );
      setLabel(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || t("skuLabel.generateFailed"),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!label) return;

    setDownloading(true);
    setError("");
    try {
      const response = await request("GET", label.downloadUrl, null, {
        responseType: "blob",
        skipAuthRedirect: true,
        skipBackendErrorDialog: true,
      });
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${label.labelRef}.${label.outputFormat.toLowerCase()}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || t("skuLabel.downloadFailed"),
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loadingProducts) {
    return <LoadingState message={t("skuLabel.loadingProducts")} />;
  }

  return (
    <Box>
      <HeaderBar
        title={t("skuLabel.title")}
        subtitle={t("skuLabel.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleGenerate}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 2fr) 1fr auto" },
          gap: 2,
          alignItems: "start",
          maxWidth: 880,
        }}
      >
        <TextField
          select
          label={t("skuLabel.product")}
          value={skuId}
          onChange={(event) => {
            setSkuId(event.target.value);
            setLabel(null);
            setError("");
          }}
          required
          fullWidth
        >
          {products.map((product) => (
            <MenuItem key={product.skuId} value={product.skuId}>
              {product.productName} ({product.productCode})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("skuLabel.outputFormat")}
          value={outputFormat}
          onChange={(event) => {
            setOutputFormat(event.target.value);
            setLabel(null);
          }}
          fullWidth
        >
          {OUTPUT_FORMATS.map((format) => (
            <MenuItem key={format} value={format}>
              {format}
            </MenuItem>
          ))}
        </TextField>
        <Button
          type="submit"
          variant="contained"
          startIcon={<QrCodeIcon />}
          disabled={generating || products.length === 0}
          sx={{ minHeight: 56 }}
        >
          {t("skuLabel.generate")}
        </Button>
      </Box>

      {products.length === 0 && !error && (
        <Alert severity="info" sx={{ mt: 2, maxWidth: 880 }}>
          {t("skuLabel.noActiveProducts")}
        </Alert>
      )}

      {label && (
        <Paper
          sx={{
            mt: 3,
            p: 3,
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <QRCodeSVG
            value={label.qrPayload}
            size={220}
            level="M"
            includeMargin
          />
          <Box sx={{ width: "100%" }}>
            <Typography variant="subtitle2">
              {t("skuLabel.labelReference")}
            </Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              {label.labelRef}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={downloading}
            fullWidth
          >
            {t("skuLabel.download", { format: label.outputFormat })}
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default SkuLabelGenerator;
