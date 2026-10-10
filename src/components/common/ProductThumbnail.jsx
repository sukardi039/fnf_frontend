import React, { useState } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { Inventory2 as InventoryIcon } from "@mui/icons-material";
import { getDisplayImageInfo, ThumbnailImg } from "../../helpers/file_helper";

export default function ProductThumbnail({
  picture, alt = "", width = 64, height = 64, fit = "contain", sx,
}) {
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
  const source = imageMeta?.id ? JSON.stringify(imageMeta) : imageUrl;
  const [failedSource, setFailedSource] = useState(null);
  const imageFailed = source === failedSource;

  return (
    <Box onErrorCapture={() => setFailedSource(source)} sx={{
      position: "relative", width, height,
      minWidth: 0, minHeight: 0, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", bgcolor: "background.default", color: "text.secondary", borderRadius: 1,
      ...sx,
    }}>
      <InventoryIcon sx={{ fontSize: 28 }} />
      {!imageFailed && imageMeta?.id ? (
        <Box sx={{ position: "absolute", inset: 0 }}>
          <ThumbnailImg
            fileId={imageMeta.id} viewUrl={imageMeta.viewUrl || ""}
            provider={imageMeta.provider || null}
            width={typeof width === "number" ? width : 240}
            height={typeof height === "number" ? height : 180} alt={alt}
            style={{ width: "100%", height: "100%", objectFit: fit }}
          />
        </Box>
      ) : !imageFailed && imageUrl ? (
        <Box component="img" src={imageUrl} alt={alt} referrerPolicy="no-referrer"
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }}
        />
      ) : null}
    </Box>
  );
}

ProductThumbnail.propTypes = {
  picture: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.array]),
  alt: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  fit: PropTypes.oneOf(["contain", "cover"]),
  sx: PropTypes.object,
};
