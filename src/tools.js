import { z } from "zod";
import { auditLog } from "./audit.js";
import { getSafetyConfig } from "./config.js";
import { toStructuredError } from "./errors.js";

export function jsonResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

const contactStatusValueSchema = z.enum(["subscribed", "pending", "unsubscribed"]);
const bounceStatusValueSchema = z.enum(["nobounce", "softbounce", "hardbounce", "spambounce"]);
const contactStatusSchema = z.array(contactStatusValueSchema).optional();
const bounceStatusSchema = z.array(bounceStatusValueSchema).optional();
const dryRunSchema = z.boolean().optional();
const destructiveShape = {
  confirm: z.literal(true),
  target_summary: z.string().min(1),
  dry_run: dryRunSchema,
};

function maybeValidateWritePayload(args, keys) {
  const payload = {};

  for (const key of keys) {
    if (args[key] !== undefined) {
      payload[key] = args[key];
    }
  }

  return payload;
}

function maybeReturnDryRun(toolName, args, preview) {
  if (!args?.dry_run) {
    return null;
  }

  return jsonResult({
    ok: true,
    dry_run: true,
    tool: toolName,
    preview,
  });
}

function normalizeCreateTagResult(result) {
  if (Array.isArray(result) && result.length > 0) {
    return { id: result[0] };
  }

  return result;
}

function wrapReadTool(toolName, operation, callback) {
  return async (args) => {
    try {
      const result = await callback(args);
      return jsonResult({ ok: true, operation, result });
    } catch (error) {
      return jsonResult({ ok: false, operation, error: toStructuredError(error) });
    }
  };
}

function wrapWriteTool(env, toolName, operation, callback) {
  return async (args) => {
    const preview = maybeReturnDryRun(toolName, args, {
      operation,
      arguments: args,
    });

    if (preview) {
      auditLog(env, { tool: toolName, action: "dry_run", level: "write", args });
      return preview;
    }

    auditLog(env, { tool: toolName, action: "request", level: "write", args });

    try {
      const result = await callback(args);
      auditLog(env, { tool: toolName, action: "success", level: "write" });
      return jsonResult({ ok: true, operation, result });
    } catch (error) {
      const structured = toStructuredError(error);
      auditLog(env, { tool: toolName, action: "error", level: "write", error: structured });
      return jsonResult({ ok: false, operation, error: structured });
    }
  };
}

function wrapDestructiveTool(env, toolName, operation, callback) {
  return async (args) => {
    const preview = maybeReturnDryRun(toolName, args, {
      operation,
      target_summary: args.target_summary,
      arguments: args,
    });

    if (preview) {
      auditLog(env, { tool: toolName, action: "dry_run", level: "destructive", args });
      return preview;
    }

    auditLog(env, { tool: toolName, action: "request", level: "destructive", args });

    try {
      const result = await callback(args);
      auditLog(env, { tool: toolName, action: "success", level: "destructive" });
      return jsonResult({ ok: true, operation, result });
    } catch (error) {
      const structured = toStructuredError(error);
      auditLog(env, { tool: toolName, action: "error", level: "destructive", error: structured });
      return jsonResult({ ok: false, operation, error: structured });
    }
  };
}

export function getToolDefinitions(client, env = process.env) {
  const safety = getSafetyConfig(env);
  const tools = [
    {
      name: "list_tags",
      description: "List KlickTipp tags as id/name pairs.",
      inputSchema: {},
      callback: wrapReadTool("list_tags", "list_tags", async () => {
        const tags = await client.listTags();
        return {
          count: Object.keys(tags ?? {}).length,
          items: Object.entries(tags ?? {}).map(([id, name]) => ({ id, name })),
        };
      }),
    },
    {
      name: "get_tag",
      description: "Get one KlickTipp tag by tag ID.",
      inputSchema: { tagid: z.number().int().positive() },
      callback: wrapReadTool("get_tag", "get_tag", ({ tagid }) => client.getTag(tagid)),
    },
    {
      name: "list_fields",
      description: "List KlickTipp data fields as id/name pairs.",
      inputSchema: {},
      callback: wrapReadTool("list_fields", "list_fields", async () => {
        const fields = await client.listFields();
        return {
          count: Object.keys(fields ?? {}).length,
          items: Object.entries(fields ?? {}).map(([id, name]) => ({ id, name })),
        };
      }),
    },
    {
      name: "get_field",
      description: "Get one KlickTipp data field by field ID. Accepts IDs returned by list_fields, for example fieldFirstName or field203826, and also raw API IDs such as FirstName or 203826.",
      inputSchema: { fieldid: z.string().min(1) },
      callback: wrapReadTool("get_field", "get_field", ({ fieldid }) => client.getField(fieldid)),
    },
    {
      name: "list_opt_in_processes",
      description: "List KlickTipp opt-in processes as id/name pairs.",
      inputSchema: {},
      callback: wrapReadTool("list_opt_in_processes", "list_opt_in_processes", async () => {
        const lists = await client.listOptInProcesses();
        return {
          count: Object.keys(lists ?? {}).length,
          items: Object.entries(lists ?? {}).map(([id, name]) => ({ id, name })),
        };
      }),
    },
    {
      name: "get_opt_in_process",
      description: "Get one KlickTipp opt-in process by list ID.",
      inputSchema: { listid: z.union([z.string().min(1), z.number().int().positive()]) },
      callback: wrapReadTool("get_opt_in_process", "get_opt_in_process", ({ listid }) =>
        client.getOptInProcess(listid),
      ),
    },
    {
      name: "get_opt_in_process_redirect",
      description: "Get the redirect URL for a specific KlickTipp opt-in process and email address.",
      inputSchema: {
        listid: z.union([z.string().min(1), z.number().int().positive()]),
        email: z.string().email(),
      },
      callback: wrapReadTool("get_opt_in_process_redirect", "get_opt_in_process_redirect", ({ listid, email }) =>
        client.getOptInProcessRedirect({ listid, email }),
      ),
    },
    {
      name: "list_contacts",
      description: "List KlickTipp contact IDs with optional status and bounce status filters. Allowed status values: subscribed, pending, unsubscribed. Allowed bounceStatus values: nobounce, softbounce, hardbounce, spambounce.",
      inputSchema: {
        status: contactStatusSchema,
        bounceStatus: bounceStatusSchema,
      },
      callback: wrapReadTool("list_contacts", "list_contacts", ({ status, bounceStatus }) =>
        client.listContacts({ status, bounceStatus }),
      ),
    },
    {
      name: "get_contact",
      description: "Get one KlickTipp contact by contact ID.",
      inputSchema: { subscriberid: z.union([z.string().min(1), z.number().int().positive()]) },
      callback: wrapReadTool("get_contact", "get_contact", ({ subscriberid }) =>
        client.getContact(subscriberid),
      ),
    },
    {
      name: "search_contact",
      description: "Search for a KlickTipp contact ID by email address.",
      inputSchema: { email: z.string().email() },
      callback: wrapReadTool("search_contact", "search_contact", ({ email }) =>
        client.searchContact({ email }),
      ),
    },
    {
      name: "search_tagged_contacts",
      description: "List tagged KlickTipp contacts for one tag, with optional status and bounce status filters. Allowed status values: subscribed, pending, unsubscribed. Allowed bounceStatus values: nobounce, softbounce, hardbounce, spambounce.",
      inputSchema: {
        tagid: z.number().int().positive(),
        status: contactStatusSchema,
        bounceStatus: bounceStatusSchema,
      },
      callback: wrapReadTool("search_tagged_contacts", "search_tagged_contacts", ({ tagid, status, bounceStatus }) =>
        client.searchTaggedContacts({ tagid, status, bounceStatus }),
      ),
    },
  ];

  if (safety.writesAllowed) {
    tools.push(
      {
        name: "create_tag",
        description: "Create a new KlickTipp tag.",
        inputSchema: {
          name: z.string().min(1),
          text: z.string().optional(),
          dry_run: dryRunSchema,
        },
        callback: wrapWriteTool(env, "create_tag", "create_tag", async ({ name, text }) =>
          normalizeCreateTagResult(
            await client.createTag(maybeValidateWritePayload({ name, text }, ["name", "text"])),
          ),
        ),
      },
      {
        name: "update_tag",
        description: "Update an existing KlickTipp tag by tag ID.",
        inputSchema: {
          tagid: z.number().int().positive(),
          name: z.string().min(1).optional(),
          text: z.string().optional(),
          dry_run: dryRunSchema,
        },
        callback: wrapWriteTool(env, "update_tag", "update_tag", ({ tagid, name, text }) =>
          client.updateTag(tagid, maybeValidateWritePayload({ name, text }, ["name", "text"])),
        ),
      },
      {
        name: "create_or_update_contact",
        description: "Create a new KlickTipp contact or update an existing one by email or SMS number.",
        inputSchema: {
          email: z.string().email().optional(),
          smsnumber: z.string().min(1).optional(),
          listid: z.number().int().positive().optional(),
          tagid: z.number().int().positive().optional(),
          fields: z.record(z.string()).optional(),
          dry_run: dryRunSchema,
        },
        callback: wrapWriteTool(env, "create_or_update_contact", "create_or_update_contact", (args) => {
          if (!args.email && !args.smsnumber) {
            throw new Error("Either email or smsnumber is required.");
          }

          return client.createOrUpdateContact(
            maybeValidateWritePayload(args, ["email", "smsnumber", "listid", "tagid", "fields"]),
          );
        }),
      },
      {
        name: "update_contact",
        description: "Update an existing KlickTipp contact by contact ID.",
        inputSchema: {
          subscriberid: z.union([z.string().min(1), z.number().int().positive()]),
          newemail: z.string().email().optional(),
          newsmsnumber: z.string().min(1).optional(),
          fields: z.record(z.string()).optional(),
          dry_run: dryRunSchema,
        },
        callback: wrapWriteTool(env, "update_contact", "update_contact", ({ subscriberid, ...rest }) =>
          client.updateContact(subscriberid, maybeValidateWritePayload(rest, ["newemail", "newsmsnumber", "fields"])),
        ),
      },
      {
        name: "tag_contact",
        description: "Assign one or more existing KlickTipp tags to a contact by email address.",
        inputSchema: {
          email: z.string().email(),
          tagids: z.array(z.number().int().positive()).min(1),
          dry_run: dryRunSchema,
        },
        callback: wrapWriteTool(env, "tag_contact", "tag_contact", ({ email, tagids }) =>
          client.tagContact({ email, tagids }),
        ),
      },
      {
        name: "untag_contact",
        description: "Remove one existing KlickTipp tag from a contact by email address.",
        inputSchema: {
          email: z.string().email(),
          tagid: z.number().int().positive(),
          dry_run: dryRunSchema,
        },
        callback: wrapWriteTool(env, "untag_contact", "untag_contact", ({ email, tagid }) =>
          client.untagContact({ email, tagid }),
        ),
      },
    );
  }

  if (safety.destructiveAllowed) {
    tools.push(
      {
        name: "delete_tag",
        description: "Delete an existing KlickTipp tag by tag ID.",
        inputSchema: {
          tagid: z.number().int().positive(),
          ...destructiveShape,
        },
        callback: wrapDestructiveTool(env, "delete_tag", "delete_tag", ({ tagid }) => client.deleteTag(tagid)),
      },
      {
        name: "delete_contact",
        description: "Delete a KlickTipp contact by contact ID.",
        inputSchema: {
          subscriberid: z.union([z.string().min(1), z.number().int().positive()]),
          ...destructiveShape,
        },
        callback: wrapDestructiveTool(env, "delete_contact", "delete_contact", ({ subscriberid }) =>
          client.deleteContact(subscriberid),
        ),
      },
      {
        name: "unsubscribe_contact",
        description: "Unsubscribe a KlickTipp contact by email address.",
        inputSchema: {
          email: z.string().email(),
          ...destructiveShape,
        },
        callback: wrapDestructiveTool(env, "unsubscribe_contact", "unsubscribe_contact", ({ email }) =>
          client.unsubscribeContact({ email }),
        ),
      },
    );
  }

  return tools;
}
