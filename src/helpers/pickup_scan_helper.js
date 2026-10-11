const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const validIdentifier = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 128;

export const readPickupTokenNavigation = (rawToken) => {
  const token = String(rawToken || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every(Boolean)) {
    throw new Error("pickup.invalidScannedToken");
  }

  let claims;
  try {
    claims = JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    throw new Error("pickup.invalidScannedToken");
  }

  if (!validIdentifier(claims?.transactionId)) {
    throw new Error("pickup.invalidScannedToken");
  }

  if (claims.purpose === "ARRIVAL") {
    if (!validIdentifier(claims.storeId)) {
      throw new Error("pickup.invalidScannedToken");
    }
    return {
      purpose: "ARRIVAL",
      transactionId: claims.transactionId,
      storeId: claims.storeId,
    };
  }

  if (claims.purpose === "COLLECTION_HANDOVER") {
    return {
      purpose: "COLLECTION",
      transactionId: claims.transactionId,
      storeId: null,
    };
  }

  throw new Error("pickup.invalidScannedToken");
};

export const normalizePickupReference = (value) => {
  const reference = String(value || "").trim().replace(/^#/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{3,127}$/.test(reference)) {
    throw new Error("pickup.referenceInvalid");
  }
  return reference;
};

export const matchesPickupReference = (transactionId, reference) => {
  const id = String(transactionId || "").toLowerCase();
  const normalized = String(reference || "").toLowerCase();
  return id === normalized || id.endsWith(normalized);
};
