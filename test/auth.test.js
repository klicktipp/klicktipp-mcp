import test from "node:test";
import assert from "node:assert/strict";
import { buildGrantAccessUrl, buildPartnerCipher, getAuthMode, getPartnerHeaders } from "../src/auth.js";

test("buildPartnerCipher matches known KlickTipp partner ciphertext", () => {
  assert.equal(
    buildPartnerCipher("0123456789abcdef", "customer-key"),
    "cZkWFoPs3rLacJ4OpaooJMMOcb/fLxbZpeeOzJFCGh1jdXN0b21lci1rZXk=",
  );
});

test("buildGrantAccessUrl keeps the redirect URL unencoded as required by KlickTipp docs", () => {
  assert.equal(
    buildGrantAccessUrl(
      "12345",
      "https://example.com/klicktipp/callback?customerkey=",
    ),
    "https://app.klicktipp.com/grantapiaccess/12345?url=https://example.com/klicktipp/callback?customerkey=",
  );
});

test("getAuthMode defaults to readonly partner-mode server usage", () => {
  assert.equal(getAuthMode({ KT_AUTH_MODE: "partner" }), "partner");
  assert.equal(getAuthMode({ KT_AUTH_MODE: "session" }), "session");
});

test("getPartnerHeaders builds X-Un and X-Ci", () => {
  const headers = getPartnerHeaders({
    KT_USERNAME: "partner-user",
    KT_DEVELOPER_KEY: "0123456789abcdef",
    KT_CUSTOMER_KEY: "customer-key",
  });

  assert.equal(headers["X-Un"], "partner-user");
  assert.equal(headers["X-Ci"], "cZkWFoPs3rLacJ4OpaooJMMOcb/fLxbZpeeOzJFCGh1jdXN0b21lci1rZXk=");
});
