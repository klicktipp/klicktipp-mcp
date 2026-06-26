import test from "node:test";
import assert from "node:assert/strict";
import { getToolDefinitions } from "../src/tools.js";
import { KlickTippApiError } from "../src/errors.js";

function parseToolResult(result) {
  return JSON.parse(result.content[0].text);
}

function getToolMap(env = {}, client = {}) {
  const tools = getToolDefinitions(client, env);
  return new Map(tools.map((tool) => [tool.name, tool]));
}

function createMockClient() {
  const calls = [];
  const client = {
    listTags: async () => ({ "21": "tag-a" }),
    getTag: async (tagid) => {
      calls.push(["getTag", tagid]);
      return { tagid: String(tagid) };
    },
    listFields: async () => ({ fieldFirstName: "First Name" }),
    getField: async (fieldid) => {
      calls.push(["getField", fieldid]);
      return { id: fieldid };
    },
    listOptInProcesses: async () => ({ "3": "" }),
    getOptInProcess: async (listid) => {
      calls.push(["getOptInProcess", listid]);
      return { listid };
    },
    getOptInProcessRedirect: async (payload) => {
      calls.push(["getOptInProcessRedirect", payload]);
      return ["https://example.com"];
    },
    listContacts: async (filters) => {
      calls.push(["listContacts", filters]);
      return { subscribers: ["1"] };
    },
    getContact: async (subscriberid) => {
      calls.push(["getContact", subscriberid]);
      return { id: String(subscriberid) };
    },
    searchContact: async (payload) => {
      calls.push(["searchContact", payload]);
      return [3];
    },
    searchTaggedContacts: async (payload) => {
      calls.push(["searchTaggedContacts", payload]);
      return { "3": "1760530436" };
    },
    createTag: async (payload) => {
      calls.push(["createTag", payload]);
      return [49];
    },
    updateTag: async (tagid, payload) => {
      calls.push(["updateTag", tagid, payload]);
      return [true];
    },
    createOrUpdateContact: async (payload) => {
      calls.push(["createOrUpdateContact", payload]);
      return { id: "1", ...payload };
    },
    updateContact: async (subscriberid, payload) => {
      calls.push(["updateContact", subscriberid, payload]);
      return [true];
    },
    tagContact: async (payload) => {
      calls.push(["tagContact", payload]);
      return [true];
    },
    untagContact: async (payload) => {
      calls.push(["untagContact", payload]);
      return [true];
    },
    deleteTag: async (tagid) => {
      calls.push(["deleteTag", tagid]);
      return [true];
    },
    deleteContact: async (subscriberid) => {
      calls.push(["deleteContact", subscriberid]);
      return [true];
    },
    unsubscribeContact: async (payload) => {
      calls.push(["unsubscribeContact", payload]);
      return [true];
    },
  };

  return { client, calls };
}

test("readonly mode exposes only read/search tools", () => {
  const toolMap = getToolMap({}, {});
  assert.ok(toolMap.has("list_tags"));
  assert.ok(toolMap.has("get_contact"));
  assert.ok(!toolMap.has("create_or_update_contact"));
  assert.ok(!toolMap.has("delete_contact"));
});

test("write mode exposes write tools but not destructive tools", () => {
  const toolMap = getToolMap({ KT_TOOL_MODE: "full", KT_ENABLE_WRITES: "true" }, {});
  assert.ok(toolMap.has("create_or_update_contact"));
  assert.ok(toolMap.has("tag_contact"));
  assert.ok(!toolMap.has("delete_contact"));
});

test("destructive mode exposes destructive tools", () => {
  const toolMap = getToolMap(
    { KT_TOOL_MODE: "full", KT_ENABLE_WRITES: "true", KT_ENABLE_DESTRUCTIVE: "true" },
    {},
  );
  assert.ok(toolMap.has("delete_contact"));
  assert.ok(toolMap.has("delete_tag"));
  assert.ok(toolMap.has("unsubscribe_contact"));
});

test("read tool handlers map payloads correctly", async () => {
  const { client, calls } = createMockClient();
  const tools = getToolMap({}, client);

  assert.deepEqual(parseToolResult(await tools.get("list_tags").callback({})).result.items, [
    { id: "21", name: "tag-a" },
  ]);
  await tools.get("get_tag").callback({ tagid: 21 });
  await tools.get("get_field").callback({ fieldid: "fieldFirstName" });
  await tools.get("get_opt_in_process").callback({ listid: 3 });
  await tools.get("get_opt_in_process_redirect").callback({ listid: 3, email: "x@example.com" });
  await tools.get("list_contacts").callback({ status: ["subscribed"], bounceStatus: ["nobounce"] });
  await tools.get("get_contact").callback({ subscriberid: 5 });
  await tools.get("search_contact").callback({ email: "x@example.com" });
  await tools.get("search_tagged_contacts").callback({ tagid: 17, status: ["subscribed"] });

  assert.deepEqual(calls, [
    ["getTag", 21],
    ["getField", "fieldFirstName"],
    ["getOptInProcess", 3],
    ["getOptInProcessRedirect", { listid: 3, email: "x@example.com" }],
    ["listContacts", { status: ["subscribed"], bounceStatus: ["nobounce"] }],
    ["getContact", 5],
    ["searchContact", { email: "x@example.com" }],
    ["searchTaggedContacts", { tagid: 17, status: ["subscribed"], bounceStatus: undefined }],
  ]);
});

test("get_field accepts IDs returned by list_fields for global and custom fields", async () => {
  const { client, calls } = createMockClient();
  const tools = getToolMap({}, client);

  await tools.get("get_field").callback({ fieldid: "fieldFirstName" });
  await tools.get("get_field").callback({ fieldid: "203826" });
  await tools.get("get_field").callback({ fieldid: "field203826" });

  assert.deepEqual(calls, [
    ["getField", "fieldFirstName"],
    ["getField", "203826"],
    ["getField", "field203826"],
  ]);
});

test("write tool handlers map payloads correctly", async () => {
  const { client, calls } = createMockClient();
  const tools = getToolMap({ KT_TOOL_MODE: "full", KT_ENABLE_WRITES: "true" }, client);

  const createTagPayload = parseToolResult(await tools.get("create_tag").callback({ name: "new-tag" }));
  await tools.get("update_tag").callback({ tagid: 12, name: "updated" });
  await tools.get("create_or_update_contact").callback({ email: "x@example.com", fields: { fieldFirstName: "X" } });
  await tools.get("update_contact").callback({ subscriberid: 4, newemail: "new@example.com" });
  await tools.get("tag_contact").callback({ email: "x@example.com", tagids: [17, 18] });
  await tools.get("untag_contact").callback({ email: "x@example.com", tagid: 17 });

  assert.deepEqual(createTagPayload.result, { id: 49 });

  assert.deepEqual(calls, [
    ["createTag", { name: "new-tag" }],
    ["updateTag", 12, { name: "updated" }],
    ["createOrUpdateContact", { email: "x@example.com", fields: { fieldFirstName: "X" } }],
    ["updateContact", 4, { newemail: "new@example.com" }],
    ["tagContact", { email: "x@example.com", tagids: [17, 18] }],
    ["untagContact", { email: "x@example.com", tagid: 17 }],
  ]);
});

test("destructive tool handlers require explicit inputs and map payloads correctly", async () => {
  const { client, calls } = createMockClient();
  const tools = getToolMap(
    { KT_TOOL_MODE: "full", KT_ENABLE_WRITES: "true", KT_ENABLE_DESTRUCTIVE: "true" },
    client,
  );

  await tools.get("delete_tag").callback({ tagid: 12, confirm: true, target_summary: "Delete tag 12" });
  await tools.get("delete_contact").callback({ subscriberid: 44, confirm: true, target_summary: "Delete contact 44" });
  await tools.get("unsubscribe_contact").callback({
    email: "x@example.com",
    confirm: true,
    target_summary: "Unsubscribe x@example.com",
  });

  assert.deepEqual(calls, [
    ["deleteTag", 12],
    ["deleteContact", 44],
    ["unsubscribeContact", { email: "x@example.com" }],
  ]);
});

test("all write and destructive handlers support dry-run without calling KlickTipp", async () => {
  const { client, calls } = createMockClient();
  const tools = getToolMap(
    { KT_TOOL_MODE: "full", KT_ENABLE_WRITES: "true", KT_ENABLE_DESTRUCTIVE: "true", KT_AUDIT_LOGS: "false" },
    client,
  );

  const dryRunChecks = [
    ["create_tag", { name: "new-tag", dry_run: true }],
    ["update_tag", { tagid: 12, name: "updated", dry_run: true }],
    ["create_or_update_contact", { email: "x@example.com", dry_run: true }],
    ["update_contact", { subscriberid: 4, newemail: "new@example.com", dry_run: true }],
    ["tag_contact", { email: "x@example.com", tagids: [17], dry_run: true }],
    ["untag_contact", { email: "x@example.com", tagid: 17, dry_run: true }],
    ["delete_tag", { tagid: 12, confirm: true, target_summary: "Delete tag 12", dry_run: true }],
    ["delete_contact", { subscriberid: 44, confirm: true, target_summary: "Delete contact 44", dry_run: true }],
    ["unsubscribe_contact", { email: "x@example.com", confirm: true, target_summary: "Unsubscribe x@example.com", dry_run: true }],
  ];

  for (const [toolName, args] of dryRunChecks) {
    const payload = parseToolResult(await tools.get(toolName).callback(args));
    assert.equal(payload.ok, true);
    assert.equal(payload.dry_run, true);
    assert.equal(payload.tool, toolName);
  }

  assert.equal(calls.length, 0);
});

test("tool handlers return structured KlickTipp business errors", async () => {
  const toolMap = getToolMap(
    { KT_TOOL_MODE: "full", KT_ENABLE_WRITES: "true" },
    {
      createTag: async () => {
        throw new KlickTippApiError(406, ["Error 4"], "KlickTipp API request failed with status 406: [\"Error 4\"]");
      },
    },
  );

  const payload = parseToolResult(await toolMap.get("create_tag").callback({ name: "new-tag" }));
  assert.equal(payload.ok, false);
  assert.equal(payload.error.type, "business_validation_error");
  assert.equal(payload.error.status, 406);
  assert.deepEqual(payload.error.body, ["Error 4"]);
});
