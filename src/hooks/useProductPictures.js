import { useEffect, useState } from "react";
import { listProducts } from "../components/catalog/productApi";

export default function useProductPictures(items) {
  const [result, setResult] = useState({ key: "", pictures: {}, error: false });
  const missingPictureKey = JSON.stringify([...new Set(items
    .filter((item) => !item.productPicture && typeof item.skuId === "string" && item.skuId.trim())
    .map((item) => item.skuId))].sort());

  useEffect(() => {
    let active = true;
    if (missingPictureKey === "[]") return;
    const loadPictures = async () => {
      const missing = new Set(JSON.parse(missingPictureKey));
      const pictures = {};
      let page = 0;
      let received = 0;
      let total;
      do {
        const { data } = await listProducts({ active: true, page, pageSize: 100 });
        if (!active) return;
        if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || data.total < 0 ||
            data.items.some((product) => !product || typeof product !== "object" ||
              (product.skuId != null && typeof product.skuId !== "string")) ||
            (data.items.length === 0 && received < data.total)) {
          throw new Error("Invalid product catalog response");
        }
        total = data.total;
        data.items.forEach((product) => {
          if (missing.has(product.skuId)) {
            pictures[product.skuId] = product.productPicture;
            missing.delete(product.skuId);
          }
        });
        received += data.items.length;
        page += 1;
      } while (missing.size && received < total);
      setResult({ key: missingPictureKey, pictures, error: false });
    };
    loadPictures().catch(() => {
      if (active) setResult({ key: missingPictureKey, pictures: {}, error: true });
    });
    return () => { active = false; };
  }, [missingPictureKey]);

  return result.key === missingPictureKey
    ? { catalogPictures: result.pictures, pictureError: result.error }
    : { catalogPictures: {}, pictureError: false };
}
