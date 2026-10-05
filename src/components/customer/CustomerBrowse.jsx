import React from "react";
import PropTypes from "prop-types";
import ProductCatalog from "../checkout/ProductCatalog";

export default function CustomerBrowse({ onAddToCart }) {
  return <ProductCatalog onAddToCart={onAddToCart} />;
}

CustomerBrowse.propTypes = {
  onAddToCart: PropTypes.func,
};

CustomerBrowse.defaultProps = {
  onAddToCart: null,
};
