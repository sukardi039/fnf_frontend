import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Alert,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../common";
import ProductThumbnail from "../common/ProductThumbnail";
import useProductPictures from "../../hooks/useProductPictures";

export default function CheckoutCartItems({
  items,
  onRemove,
  onUpdateQuantity,
  disabled = false,
  editingDisabled = false,
  onSubmit,
  submitLabel,
  submitDisabled = false,
}) {
  const { t } = useTranslation();
  const { catalogPictures, pictureError } = useProductPictures(items);
  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity), 0),
    [items],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("customer.cart.empty")}
        description={t("customer.cart.emptyDescription")}
      />
    );
  }

  return (
    <Box>
      {pictureError && <Alert severity="warning" sx={{ mb: 1 }}>{t("customer.cart.picturesFailed")}</Alert>}
      <List disablePadding>
        {items.map((item, index) => (
          <React.Fragment key={item.skuId}>
            <ListItem
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label={t("customer.cart.removeItem", {
                    product: item.productName,
                  })}
                  onClick={() => onRemove?.(item.skuId)}
                  disabled={disabled || editingDisabled}
                >
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ProductThumbnail
                picture={item.productPicture || catalogPictures[item.skuId]}
                alt={item.productName} sx={{ m: 1 }}
              />
              <ListItemText
                primary={item.productName}
                secondary={`${item.quantity} ${item.uom}`}
              />
              <TextField
                type="number"
                label={t("customer.browse.quantity")}
                size="small"
                value={item.quantity}
                onChange={(event) =>
                  onUpdateQuantity?.(item.skuId, event.target.value)
                }
                inputProps={{ min: 0.001, step: "0.001" }}
                disabled={disabled || editingDisabled}
                sx={{ width: { xs: 75, sm: 110 }, flexShrink: 0, ml: 1, mr: { xs: 0, sm: 6 } }}
              />
            </ListItem>
            {index < items.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: 2,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="subtitle1">
          {t("customer.cart.totalItems", { count: totalItems })}
        </Typography>
        {onSubmit && (
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={disabled || submitDisabled}
          >
            {submitLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
}

CheckoutCartItems.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRemove: PropTypes.func,
  onUpdateQuantity: PropTypes.func,
  disabled: PropTypes.bool,
  editingDisabled: PropTypes.bool,
  onSubmit: PropTypes.func,
  submitLabel: PropTypes.node,
  submitDisabled: PropTypes.bool,
};
