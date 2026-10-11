import { describe, expect, it } from "vitest";
import {
  matchesPickupReference,
  normalizePickupReference,
  readPickupTokenNavigation,
} from "./pickup_scan_helper";

const tokenWithClaims = (claims) => {
  const encode = (value) => btoa(JSON.stringify(value))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
};

describe("pickup scan navigation", () => {
  it("extracts arrival navigation claims without treating them as authorization", () => {
    const token = tokenWithClaims({
      purpose: "ARRIVAL",
      transactionId: "txn_123",
      storeId: "STORE-1",
      customerId: "CUSTOMER-1",
    });

    expect(readPickupTokenNavigation(token)).toEqual({
      purpose: "ARRIVAL",
      transactionId: "txn_123",
      storeId: "STORE-1",
    });
  });

  it("extracts collection navigation claims", () => {
    const token = tokenWithClaims({
      purpose: "COLLECTION_HANDOVER",
      transactionId: "txn_123",
    });

    expect(readPickupTokenNavigation(token)).toEqual({
      purpose: "COLLECTION",
      transactionId: "txn_123",
      storeId: null,
    });
  });

  it.each([
    "not-a-token",
    tokenWithClaims({ purpose: "ARRIVAL", transactionId: "txn_123" }),
    tokenWithClaims({ purpose: "UNKNOWN", transactionId: "txn_123" }),
    tokenWithClaims({ purpose: "COLLECTION_HANDOVER", transactionId: "" }),
  ])("rejects unusable scan payloads", (token) => {
    expect(() => readPickupTokenNavigation(token)).toThrow("pickup.invalidScannedToken");
  });
});

describe("pickup reference lookup", () => {
  it("normalizes the customer-facing compact reference", () => {
    expect(normalizePickupReference("  #25cc4d  ")).toBe("25cc4d");
  });

  it("matches a full transaction ID or suffix case-insensitively", () => {
    const transactionId = "txn_2f932c51-174b-4935-9901-ec343a25cc4d";
    expect(matchesPickupReference(transactionId, "EC343A25CC4D")).toBe(true);
    expect(matchesPickupReference(transactionId, transactionId.toUpperCase())).toBe(true);
    expect(matchesPickupReference(transactionId, "25cc4e")).toBe(false);
  });

  it("rejects references that are too short or unsafe", () => {
    expect(() => normalizePickupReference("#abc")).toThrow("pickup.referenceInvalid");
    expect(() => normalizePickupReference("bad code")).toThrow("pickup.referenceInvalid");
  });
});
