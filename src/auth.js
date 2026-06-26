import crypto from "node:crypto";

function normalizeHexKey(input) {
  const normalized = String(input ?? "").replace(/\s+/g, "").toLowerCase();

  if (!normalized) {
    throw new Error("KT_DEVELOPER_KEY is required for partner auth.");
  }

  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("KT_DEVELOPER_KEY must be an even-length hexadecimal string.");
  }

  return normalized;
}

export function buildPartnerCipher(developerKey, customerKey) {
  const normalizedDeveloperKey = normalizeHexKey(developerKey);
  const normalizedCustomerKey = String(customerKey ?? "").trim();

  if (!normalizedCustomerKey) {
    throw new Error("KT_CUSTOMER_KEY is required for partner auth.");
  }

  const hmac = crypto
    .createHmac("sha256", Buffer.from(normalizedDeveloperKey, "hex"))
    .update(normalizedCustomerKey, "utf8")
    .digest();

  return Buffer.concat([hmac, Buffer.from(normalizedCustomerKey, "utf8")]).toString("base64");
}

export function buildGrantAccessUrl(accountId, redirectUrl) {
  const normalizedAccountId = String(accountId ?? "").trim();
  const normalizedRedirectUrl = String(redirectUrl ?? "").trim();

  if (!normalizedAccountId || !normalizedRedirectUrl) {
    throw new Error("Both accountId and redirectUrl are required to build the grant URL.");
  }

  return `https://app.klicktipp.com/grantapiaccess/${encodeURIComponent(normalizedAccountId)}?url=${normalizedRedirectUrl}`;
}

export function getAuthMode(env) {
  const authMode = String(env.KT_AUTH_MODE ?? "partner").trim().toLowerCase();

  if (authMode !== "partner" && authMode !== "session") {
    throw new Error("KT_AUTH_MODE must be either 'partner' or 'session'.");
  }

  return authMode;
}

export function getPartnerHeaders(env) {
  const username = String(env.KT_USERNAME ?? "").trim();

  if (!username) {
    throw new Error("KT_USERNAME is required for partner auth.");
  }

  return {
    "X-Un": username,
    "X-Ci": buildPartnerCipher(env.KT_DEVELOPER_KEY, env.KT_CUSTOMER_KEY),
  };
}
