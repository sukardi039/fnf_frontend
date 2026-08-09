import { request } from "./axios_helper";

/**
 * QR token helpers.
 *
 * Tokens are issued and verified by the backend. The frontend no longer performs
 * client-side signing, so no signing secret is compiled into the browser bundle.
 * Use issueQrToken() to request a backend-signed token and decodeToken() is
 * retained only as a local parse helper for legacy/development tokens.
 */

export class QrTokenError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "QrTokenError";
    this.code = code;
  }
}

/**
 * Request a backend-signed QR token for an entity.
 *
 * @param {string} entityId
 * @param {{ maxAgeMinutes?: number, noTimeScope?: boolean }} [options]
 * @returns {Promise<string>} compact signed QR token
 */
export async function issueQrToken(entityId, options = {}) {
  const response = await request(
    "POST",
    "/api/v1/qr-tokens",
    {
      entityId: String(entityId).trim(),
      maxAgeMinutes: options.maxAgeMinutes,
      noTimeScope: options.noTimeScope === true,
    },
    {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      skipAuthRedirect: true,
      skipBackendErrorDialog: true,
    },
  );

  const token = response.data?.qrToken || response.data?.token;
  if (!token) {
    throw new QrTokenError(
      "Backend did not return a QR token.",
      "MISSING_TOKEN",
    );
  }
  return token;
}

/**
 * Request the backend to resolve and verify a signed QR payload.
 *
 * @param {string} qrPayload
 * @returns {Promise<{ entityId: string }>}
 */
export async function resolveQrToken(qrPayload) {
  const response = await request(
    "POST",
    "/api/v1/labels/resolve-qr",
    { qrPayload: String(qrPayload) },
    {
      skipAuthRedirect: true,
      skipBackendErrorDialog: true,
    },
  );
  return response.data;
}

/**
 * Decode a QR token locally. This is a best-effort parse helper and does NOT
 * verify the signature (the frontend no longer has the signing secret).
 *
 * @param {string} token
 * @returns {Promise<string|null>} entityId, or null on parse failure
 */
export async function decodeToken(token) {
  if (!token || !token.includes(".")) return null;
  try {
    const separatorIndex = token.indexOf(".");
    const leftPart = token.slice(0, separatorIndex);
    const base64EntityId =
      leftPart.startsWith("q") || leftPart.startsWith("r")
        ? leftPart.slice(1)
        : leftPart;
    return atob(base64EntityId);
  } catch {
    return null;
  }
}
