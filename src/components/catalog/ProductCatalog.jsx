import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Inventory2 as InventoryIcon,
  Search as SearchIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  getDisplayImageInfo,
  ThumbnailImg,
} from "../../helpers/file_helper";
import { fetchProductFormats, listProducts } from "./productApi";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  BlockListItem,
  EmptyState,
  LoadMoreBlockList,
  LoadingState,
  PageHeader,
} from "../common";
import HelpDialog from "../common/HelpDialog";
import ProductForm from "./ProductForm";

const ProductCatalog = () => {
  const { t } = useTranslation();
  const { shouldUseBlockLayout } = useResponsiveLayout();
  const [products, setProducts] = useState([]);
  const [formats, setFormats] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const [productsResponse, formatsResponse] = await Promise.all([
        listProducts(),
        fetchProductFormats(undefined),
      ]);
      setProducts(
        Array.isArray(productsResponse.data?.items)
          ? productsResponse.data.items
          : [],
      );
      setFormats(
        Array.isArray(formatsResponse.data) ? formatsResponse.data : [],
      );
    } catch (requestError) {
      if (requestError?.response?.status === 401) {
        setError(t("product.backendPending"));
      } else {
        setError(
          requestError?.response?.data?.message || t("product.loadFailed"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [productsResponse, formatsResponse] = await Promise.all([
          listProducts(),
          fetchProductFormats(undefined),
        ]);
        if (!active) return;
        setProducts(
          Array.isArray(productsResponse.data?.items)
            ? productsResponse.data.items
            : [],
        );
        setFormats(
          Array.isArray(formatsResponse.data) ? formatsResponse.data : [],
        );
      } catch (requestError) {
        if (!active) return;
        if (requestError?.response?.status === 401) {
          setError(t("product.backendPending"));
        } else {
          setError(
            requestError?.response?.data?.message || t("product.loadFailed"),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t]);

  const formatByCode = useMemo(
    () =>
      formats.reduce((acc, format) => {
        acc[format.formatCode] = format;
        return acc;
      }, {}),
    [formats],
  );

  const rows = products.map((product) => ({
    productId: product.productId,
    skuId: product.skuId,
    productCode: product.productCode,
    productName: product.productName,
    format: product.format,
    uom: product.uom,
    price: product.price,
    currency: product.currency,
    active: product.active,
    productPicture: product.productPicture,
    displayFormat: formatByCode[product.format]?.formatName ?? product.format,
    displayPrice: `${product.currency} ${product.price}`,
    displayActive: t(`basic.${product.active}`),
  }));

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = normalizedSearch
    ? rows.filter((product) =>
        [
          product.productCode,
          product.productName,
          product.format,
          product.displayFormat,
          product.uom,
          product.currency,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedSearch),
        ),
      )
    : rows;

  const columns = [
    {
      field: "productPicture",
      headerName: t("product.productPicture", "Picture"),
      width: 80,
      align: "center",
      headerAlign: "center",
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const imageInfo = params.value
          ? getDisplayImageInfo(params.value)
          : null;
        const meta = imageInfo?.meta;
        return (
          <Box
            sx={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {meta?.id ? (
              <ThumbnailImg
                fileId={meta.id}
                viewUrl={meta.viewUrl || ""}
                provider={meta.provider || null}
                width={40}
                height={40}
                alt={params.row.productName}
                style={{ borderRadius: 4 }}
              />
            ) : imageInfo?.imageUrl ? (
              <img
                src={imageInfo.imageUrl}
                alt={params.row.productName}
                style={{
                  width: 40,
                  height: 40,
                  objectFit: "cover",
                  borderRadius: 4,
                }}
                onError={(event) => {
                  event.target.style.display = "none";
                }}
              />
            ) : (
              <InventoryIcon
                sx={{ color: "text.secondary", fontSize: "1.1rem" }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: "productName",
      headerName: t("product.productName"),
      flex: 1.5,
      minWidth: 180,
    },
    {
      field: "productCode",
      headerName: t("product.productCode"),
      flex: 1,
      minWidth: 150,
    },
    {
      field: "displayFormat",
      headerName: t("product.format"),
      flex: 1,
      minWidth: 130,
    },
    {
      field: "uom",
      headerName: t("product.uom"),
      width: 100,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "displayPrice",
      headerName: t("product.price"),
      flex: 1,
      minWidth: 130,
    },
    {
      field: "displayActive",
      headerName: t("product.active"),
      width: 100,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "actions",
      headerName: t("basic.actions"),
      width: 90,
      align: "center",
      headerAlign: "center",
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => setEditingProduct(params.row)}
          aria-label={t("product.editTitle")}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const blockColumnDefs = columns
    .filter((column) => column.field !== "actions")
    .map((column) => ({
      field: column.field,
      label: column.headerName,
    }));

  if (loading) {
    return <LoadingState message={t("product.loading")} />;
  }

  if (showAdd) {
    return (
      <ProductForm
        onCancel={(saved) => {
          setShowAdd(false);
          if (saved) loadProducts();
        }}
      />
    );
  }

  if (editingProduct) {
    return (
      <ProductForm
        product={editingProduct}
        onCancel={(saved) => {
          setEditingProduct(null);
          if (saved) loadProducts();
        }}
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title={t("product.title")}
        subtitle={t("product.subtitle")}
        icon={InventoryIcon}
        onHelpClick={() => setHelpOpen(true)}
        actionLabel={t("product.addTitle")}
        onActionClick={() => setShowAdd(true)}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("product.helpTitle")}
        content={t("product.helpBody")}
      />

      <Box
        sx={{
          mb: 3,
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("product.searchPlaceholder")}
          size="small"
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {filteredProducts.length === 0 ? (
        <EmptyState
          title={t("product.noData")}
          description={
            search
              ? t("product.noSearchResults")
              : t("product.noDataDescription")
          }
          actionLabel={!search ? t("product.addTitle") : null}
          onActionClick={!search ? () => setShowAdd(true) : null}
        />
      ) : shouldUseBlockLayout ? (
        <LoadMoreBlockList
          items={filteredProducts}
          renderItem={(product) => (
            <BlockListItem
              key={product.productId}
              columnDefs={blockColumnDefs}
              item={product}
              leadingMedia={{
                field: "productPicture",
                placeholder: (
                  <InventoryIcon
                    sx={{ color: "text.secondary", fontSize: "1.1rem" }}
                  />
                ),
                altFields: ["productName"],
                width: 40,
                height: 40,
              }}
              enableActions={false}
              t={t}
            />
          )}
        />
      ) : (
        <Box
          sx={{
            height: 600,
            width: "100%",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 1,
          }}
        >
          <DataGrid
            rows={filteredProducts}
            columns={columns}
            getRowId={(row) => row.productId}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            pageSizeOptions={[5, 10, 25, 50]}
            disableRowSelectionOnClick
            autoHeight={false}
            sx={{
              border: 0,
              "& .MuiDataGrid-cell:focus": { outline: "none" },
              "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "grey.50",
                borderRadius: 0,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ProductCatalog;
