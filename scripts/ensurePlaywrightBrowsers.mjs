import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const shouldInstall = process.env.VERCEL === "1" || process.env.CG_INSTALL_PLAYWRIGHT_BROWSERS === "true";

if (!shouldInstall) {
  process.exit(0);
}

process.env.PLAYWRIGHT_BROWSERS_PATH ||= "0";

const cli = join(process.cwd(), "node_modules", "playwright", "cli.js");

if (!existsSync(cli)) {
  throw new Error(`Playwright CLI not found at ${cli}`);
}

const result = spawnSync(process.execPath, [cli, "install", "chromium"], {
  stdio: "inherit",
  env: process.env
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
