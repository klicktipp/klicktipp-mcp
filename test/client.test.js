import test from "node:test";
import assert from "node:assert/strict";
import { KlickTippClient } from "../src/klicktipp-client.js";
import { KlickTippApiError } from "../src/errors.js";

test("partner auth headers are derived without login", async () => {
  const client = new KlickTippClient({
    KT_AUTH_MODE: "partner",
    KT_USERNAME: "partner-user",
    KT_DEVELOPER_KEY: "0123456789abcdef",
    KT_CUSTOMER_KEY: "customer-key",
  });

  const headers = await client.getAuthHeaders();
  assert.equal(headers["X-Un"], "partner-user");
  assert.equal(headers["X-Ci"], "cZkWFoPs3rLacJ4OpaooJMMOcb/fLxbZpeeOzJFCGh1jdXN0b21lci1rZXk=");
});

test("session auth logs in and reuses returned session", async () => {
  const client = new KlickTippClient({
    KT_AUTH_MODE: "session",
    KT_USERNAME: "demo-user",
    KT_PASSWORD: "secret",
  });

  client.loginWithSession = async () => {
    client.session = { sessid: "abc123", sessionName: "SESS" };
    return client.session;
  };

  const headers = await client.getAuthHeaders();
  assert.equal(headers["X-Session-Id"], "abc123");
  assert.equal(headers.Cookie, "SESS=abc123");
});

test("request throws KlickTippApiError with structured body on 406", async () => {
  const client = new KlickTippClient({
    KT_AUTH_MODE: "partner",
    KT_USERNAME: "partner-user",
    KT_DEVELOPER_KEY: "0123456789abcdef",
    KT_CUSTOMER_KEY: "customer-key",
  });

  client.fetch = async () => ({
    ok: false,
    status: 406,
    text: async () => JSON.stringify(["Error 4"]),
  });

  await assert.rejects(
    () => client.request("/subscriber", { method: "POST", body: { email: "x@example.com" } }),
    (error) => {
      assert.ok(error instanceof KlickTippApiError);
      assert.equal(error.status, 406);
      assert.deepEqual(error.body, ["Error 4"]);
      return true;
    },
  );
});

test("getField normalizes field-prefixed numeric IDs", async () => {
  const client = new KlickTippClient({
    KT_AUTH_MODE: "partner",
    KT_USERNAME: "partner-user",
    KT_DEVELOPER_KEY: "0123456789abcdef",
    KT_CUSTOMER_KEY: "customer-key",
  });

  let requestedPath = null;
  client.request = async (path) => {
    requestedPath = path;
    return { ok: true };
  };

  await client.getField("field203826");
  assert.equal(requestedPath, "/field/203826");
});

test("getField normalizes global field IDs returned by listFields", async () => {
  const client = new KlickTippClient({
    KT_AUTH_MODE: "partner",
    KT_USERNAME: "partner-user",
    KT_DEVELOPER_KEY: "0123456789abcdef",
    KT_CUSTOMER_KEY: "customer-key",
  });

  let requestedPath = null;
  client.request = async (path) => {
    requestedPath = path;
    return { ok: true };
  };

  await client.getField("fieldFirstName");
  assert.equal(requestedPath, "/field/FirstName");
});
