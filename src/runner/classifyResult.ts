import type { ResultStatus } from "../types.js";

export function classifyError(error: unknown): ResultStatus {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("timeout")) {
    return "TIMEOUT";
  }

  if (
    normalized.includes("captcha") ||
    normalized.includes("blocked") ||
    normalized.includes("access denied") ||
    normalized.includes("forbidden")
  ) {
    return "AUTOMATION_BLOCKED";
  }

  if (
    normalized.includes("net::") ||
    normalized.includes("network") ||
    normalized.includes("dns") ||
    normalized.includes("econn")
  ) {
    return "NETWORK_FAILURE";
  }

  if (normalized.includes("assertion failed")) {
    return "JOURNEY_FAILURE";
  }

  return "UNEXPECTED_STATE";
}
