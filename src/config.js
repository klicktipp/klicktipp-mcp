export function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getToolMode(env = process.env) {
  const mode = String(env.KT_TOOL_MODE ?? "readonly").trim().toLowerCase();

  if (mode !== "readonly" && mode !== "full") {
    throw new Error("KT_TOOL_MODE must be either 'readonly' or 'full'.");
  }

  return mode;
}

export function getSafetyConfig(env = process.env) {
  const toolMode = getToolMode(env);
  const enableWrites = parseBoolean(env.KT_ENABLE_WRITES, false);
  const enableDestructive = parseBoolean(env.KT_ENABLE_DESTRUCTIVE, false);
  const auditLogsEnabled = parseBoolean(env.KT_AUDIT_LOGS, true);

  return {
    toolMode,
    enableWrites,
    enableDestructive,
    auditLogsEnabled,
    writesAllowed: toolMode === "full" && enableWrites,
    destructiveAllowed: toolMode === "full" && enableWrites && enableDestructive,
  };
}
