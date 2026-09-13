import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { JourneyConfig } from "../types.js";

export async function loadJourneyConfig(filePath: string): Promise<JourneyConfig> {
  const absolutePath = resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const config = JSON.parse(expandEnvironmentVariables(raw)) as JourneyConfig;

  validateJourneyConfig(config, absolutePath);
  return config;
}

function expandEnvironmentVariables(raw: string): string {
  return raw.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, name: string) => {
    const value = process.env[name];

    if (!value) {
      throw new Error(`Missing environment variable: ${name}`);
    }

    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  });
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
