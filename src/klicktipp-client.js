import { getAuthMode, getPartnerHeaders } from "./auth.js";
import { KlickTippApiError } from "./errors.js";

function parseBody(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildQueryString(query) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function toErrorMessage(status, body) {
  if (body == null) {
    return `KlickTipp API request failed with status ${status}.`;
  }

  if (typeof body === "string") {
    return `KlickTipp API request failed with status ${status}: ${body}`;
  }

  return `KlickTipp API request failed with status ${status}: ${JSON.stringify(body)}`;
}

function normalizeFieldId(fieldId) {
  const value = String(fieldId).trim();
  const numericMatch = /^field(\d+)$/i.exec(value);

  if (numericMatch) {
    return numericMatch[1];
  }

  const globalMatch = /^field([A-Z].*)$/.exec(value);

  if (globalMatch) {
    return globalMatch[1];
  }

  return value;
}

export class KlickTippClient {
  constructor(env = process.env) {
    this.env = env;
    this.baseUrl = String(env.KT_BASE_URL ?? "https://api.klicktipp.com").replace(/\/+$/, "");
    this.timeoutMs = Number(env.KT_TIMEOUT_MS ?? 30000);
    this.authMode = getAuthMode(env);
    this.session = null;
  }

  async loginWithSession() {
    const username = String(this.env.KT_USERNAME ?? "").trim();
    const password = String(this.env.KT_PASSWORD ?? "");

    if (!username || !password) {
      throw new Error("KT_USERNAME and KT_PASSWORD are required for session auth.");
    }

    const response = await this.fetch("/account/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const body = await response.json();
    const sessid = body?.sessid;
    const sessionName = body?.session_name;

    if (!sessid || !sessionName) {
      throw new Error("Login succeeded but KlickTipp did not return sessid and session_name.");
    }

    this.session = { sessid, sessionName };
    return this.session;
  }

  async fetch(path, init) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAuthHeaders() {
    if (this.authMode === "partner") {
      return getPartnerHeaders(this.env);
    }

    if (!this.session) {
      await this.loginWithSession();
    }

    return {
      "X-Session-Id": this.session.sessid,
      Cookie: `${this.session.sessionName}=${this.session.sessid}`,
    };
  }

  async request(path, { method = "GET", body, query, retryOnAuthError = true } = {}) {
    const headers = {
      Accept: "application/json",
      ...(await this.getAuthHeaders()),
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetch(`${path}${buildQueryString(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if ((response.status === 401 || response.status === 403) && this.authMode === "session" && retryOnAuthError) {
      this.session = null;
      return this.request(path, { method, body, query, retryOnAuthError: false });
    }

    const responseText = await response.text();
    const parsedBody = parseBody(responseText);

    if (!response.ok) {
      const error = new KlickTippApiError(
        response.status,
        parsedBody,
        toErrorMessage(response.status, parsedBody),
      );
      throw error;
    }

    return parsedBody;
  }

  async listTags() {
    return this.request("/tag");
  }

  async listFields() {
    return this.request("/field");
  }

  async getField(fieldId) {
    return this.request(`/field/${encodeURIComponent(normalizeFieldId(fieldId))}`);
  }

  async listOptInProcesses() {
    return this.request("/list");
  }

  async getOptInProcess(listId) {
    return this.request(`/list/${encodeURIComponent(listId)}`);
  }

  async getOptInProcessRedirect(payload) {
    return this.request("/list/redirect", {
      method: "POST",
      body: payload,
    });
  }

  async listContacts(filters = {}) {
    return this.request("/subscriber", {
      query: filters,
    });
  }

  async createOrUpdateContact(payload) {
    return this.request("/subscriber", {
      method: "POST",
      body: payload,
    });
  }

  async getContact(subscriberId) {
    return this.request(`/subscriber/${encodeURIComponent(subscriberId)}`);
  }

  async updateContact(subscriberId, payload) {
    return this.request(`/subscriber/${encodeURIComponent(subscriberId)}`, {
      method: "PUT",
      body: payload,
    });
  }

  async deleteContact(subscriberId) {
    return this.request(`/subscriber/${encodeURIComponent(subscriberId)}`, {
      method: "DELETE",
    });
  }

  async unsubscribeContact(payload) {
    return this.request("/subscriber/unsubscribe", {
      method: "POST",
      body: payload,
    });
  }

  async tagContact(payload) {
    return this.request("/subscriber/tag", {
      method: "POST",
      body: payload,
    });
  }

  async untagContact(payload) {
    return this.request("/subscriber/untag", {
      method: "POST",
      body: payload,
    });
  }

  async searchContact(payload) {
    return this.request("/subscriber/search", {
      method: "POST",
      body: payload,
    });
  }

  async searchTaggedContacts(payload) {
    return this.request("/subscriber/tagged", {
      method: "POST",
      body: payload,
    });
  }

  async createTag(payload) {
    return this.request("/tag", {
      method: "POST",
      body: payload,
    });
  }

  async getTag(tagId) {
    return this.request(`/tag/${encodeURIComponent(tagId)}`);
  }

  async updateTag(tagId, payload) {
    return this.request(`/tag/${encodeURIComponent(tagId)}`, {
      method: "PUT",
      body: payload,
    });
  }

  async deleteTag(tagId) {
    return this.request(`/tag/${encodeURIComponent(tagId)}`, {
      method: "DELETE",
    });
  }
}
