import React from "react";
import PropTypes from "prop-types";
import ProductCatalog from "../checkout/ProductCatalog";
import { useStoreLocation } from "../../context/storeLocationContext";

export default function CustomerBrowse({ onAddToCart }) {
  const { storeId } = useStoreLocation();
  return (
    <ProductCatalog
      onAddToCart={onAddToCart}
      enablePhotoSearch
      storeId={storeId}
    />
  );
}

CustomerBrowse.propTypes = {
  onAddToCart: PropTypes.func,
};

CustomerBrowse.defaultProps = {
  onAddToCart: null,
};
