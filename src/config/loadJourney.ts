import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { JourneyConfig } from "../types.js";

export async function loadJourneyConfig(filePath: string): Promise<JourneyConfig> {
  const absolutePath = resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const config = JSON.parse(expandEnvironmentVariables(raw)) as JourneyConfig;

  validateJourneyConfig(config, absolutePath);
  validateSafety(config, absolutePath);
  return config;
}

function expandEnvironmentVariables(raw: string): string {
  return raw.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, name: string) => {
    const value = process.env[name];

    if (!value) {
      throw new Error(`Missing environment variable: ${name}`);
    }

    return normalizeEnvironmentValue(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  });
}

function normalizeEnvironmentValue(value: string): string {
  const trimmed = value.trim();
  const markdownLinkMatch = /^\[(https?:\/\/[^\]]+)\]\(https?:\/\/[^)]+\)$/.exec(trimmed);

  return markdownLinkMatch?.[1] ?? trimmed;
}

function validateJourneyConfig(config: JourneyConfig, filePath: string): void {
  const requiredStringFields: Array<keyof JourneyConfig> = ["id", "name", "baseUrl"];

  for (const field of requiredStringFields) {
    if (typeof config[field] !== "string" || String(config[field]).trim() === "") {
      throw new Error(`Invalid journey config ${filePath}: missing ${field}`);
    }
  }

  if (!Array.isArray(config.steps) || config.steps.length === 0) {
    throw new Error(`Invalid journey config ${filePath}: steps must be a non-empty array`);
  }

  for (const step of config.steps) {
    if (!step.id || !step.action) {
      throw new Error(`Invalid journey config ${filePath}: every step needs id and action`);
    }
  }
}

function validateSafety(config: JourneyConfig, filePath: string): void {
  const allowedPrefixes = config.safety?.allowedBaseUrlPrefixes ?? [];

  if (!config.stopBeforeIrreversibleAction && !config.safeSubmit) {
    throw new Error(
      `Unsafe journey config ${filePath}: irreversible actions require safeSubmit=true`
    );
  }

  if (config.safeSubmit && process.env.CG_ALLOW_SUBMIT !== "true") {
    throw new Error(
      `Unsafe journey config ${filePath}: safeSubmit requires CG_ALLOW_SUBMIT="true"`
    );
  }

  if (config.safeSubmit && allowedPrefixes.length === 0) {
    throw new Error(
      `Unsafe journey config ${filePath}: safeSubmit requires allowedBaseUrlPrefixes`
    );
  }

  if (allowedPrefixes.length > 0 && !allowedPrefixes.some((prefix) => config.baseUrl.startsWith(prefix))) {
    throw new Error(
      `Unsafe journey config ${filePath}: baseUrl "${config.baseUrl}" is not in allowedBaseUrlPrefixes`
    );
  }

  const requiredEnv = config.safety?.requiredEnv ?? {};

  for (const [name, expectedValue] of Object.entries(requiredEnv)) {
    const actualValue = process.env[name];

    if (actualValue !== expectedValue) {
      throw new Error(
        `Unsafe journey config ${filePath}: expected environment variable ${name}="${expectedValue}"`
      );
    }
  }
}
