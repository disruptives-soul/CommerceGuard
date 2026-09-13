import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { JourneyResult } from "../types.js";

export interface RunArtifacts {
  runDir: string;
  screenshotsDir: string;
  resultPath: string;
}

export async function createRunArtifacts(journeyId: string): Promise<RunArtifacts> {
  const safeJourneyId = journeyId.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = resolve("runs", safeJourneyId, timestamp);
  const screenshotsDir = join(runDir, "screenshots");

  await mkdir(screenshotsDir, { recursive: true });

  return {
    runDir,
    screenshotsDir,
    resultPath: join(runDir, "result.json")
  };
}

export async function writeResult(result: JourneyResult, resultPath: string): Promise<void> {
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
