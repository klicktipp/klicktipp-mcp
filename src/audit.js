import { getSafetyConfig } from "./config.js";

export function auditLog(env, entry) {
  const { auditLogsEnabled } = getSafetyConfig(env);

  if (!auditLogsEnabled) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  console.error(JSON.stringify(payload));
}
