import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { JourneyResult } from "../types.js";

export interface RunArtifacts {
  runId: string;
  runDir: string;
  screenshotsDir: string;
  resultPath: string;
  reportPath: string;
}

export async function createRunArtifacts(journeyId: string): Promise<RunArtifacts> {
  const safeJourneyId = journeyId.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = `${timestamp}-${randomUUID()}`;
  const runDir = resolve(runsRoot(), safeJourneyId, runId);
  const screenshotsDir = join(runDir, "screenshots");

  await mkdir(screenshotsDir, { recursive: true });

  return {
    runId,
    runDir,
    screenshotsDir,
    resultPath: join(runDir, "result.json"),
    reportPath: join(runDir, "report.md")
  };
}

function runsRoot(): string {
  if (process.env.CG_RUNS_DIR) {
    return process.env.CG_RUNS_DIR;
  }

  if (process.env.VERCEL) {
    return join(tmpdir(), "commerceguard-runs");
  }

  return "runs";
}

export async function writeResult(result: JourneyResult, resultPath: string): Promise<void> {
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

export async function writeReport(result: JourneyResult, reportPath: string): Promise<void> {
  await writeFile(reportPath, buildReport(result), "utf8");
}

function buildReport(result: JourneyResult): string {
  const failedStep = result.steps.find((step) => step.status === "FAIL");
  const screenshots = result.steps
    .filter((step) => step.screenshot)
    .map((step) => `- ${step.id}: \`${relativeRunPath(result.runDir, step.screenshot ?? "")}\``)
    .join("\n");
  const relevantEvidence = result.evidence.slice(0, 12).map((event) => {
    const url = event.url ? ` (${event.url})` : "";
    return `- ${event.timestamp} ${event.type}: ${event.message}${url}`;
  }).join("\n");

  return `# CommerceGuard Run Report

## Summary

- Journey: ${result.journeyName} (\`${result.journeyId}\`)
- Run ID: \`${result.runId}\`
- Project: ${result.projectId ?? "-"}
- Adapter: ${result.adapter ?? "-"}
- Report group: ${result.reportGroup}
- Status: ${result.status}
- Product classification: ${result.productStatus}
- Reason: ${result.reason}
- Attempts: ${result.attempts}
- Recovered by retry: ${result.recoveredByRetry ? "yes" : "no"}
- Duration: ${result.durationMs} ms
- Started: ${result.startedAt}
- Finished: ${result.finishedAt}
- Current URL: ${result.currentUrl ?? "-"}
- Evidence path: \`${result.runDir}\`

## Selected Vehicle

${result.selectedVehicle ? `- Name: ${result.selectedVehicle.name ?? "-"}
- URL: ${result.selectedVehicle.url ?? "-"}
- SKU: ${result.selectedVehicle.sku ?? "-"}
- Condition: ${result.selectedVehicle.condition ?? "-"}` : "- None captured"}

## Failure

${failedStep ? `- Step: \`${failedStep.id}\`
- Action: \`${failedStep.action}\`
- Current URL: ${failedStep.currentUrl ?? result.currentUrl ?? "-"}
- Error: ${failedStep.error ?? result.error ?? "Unknown error"}` : "- None"}

## Steps

${result.steps.map((step) => `- ${step.status} \`${step.id}\` (${step.action}) ${step.durationMs} ms ${step.currentUrl ? `- ${step.currentUrl}` : ""}`).join("\n")}

## Attempts

${result.attemptsDetail?.map((attempt) => `- Attempt ${attempt.attempt}: ${attempt.status} / ${attempt.productStatus} (${attempt.durationMs} ms)${attempt.failedStep ? ` failed at \`${attempt.failedStep}\`` : ""}`).join("\n") ?? "- Not captured"}

## Screenshots

${screenshots || "- None"}

## Evidence

${relevantEvidence || "- None"}

## Notes

- PASS means the observable browser journey reached the configured stop point.
- COMMERCE_FAILURE means the observable commerce journey failed.
- MONITOR_FAILURE means runner/config/environment failed before valid commerce evidence.
- INCONCLUSIVE means ambiguity, blocker, timeout, network failure, or retry recovery needs review.
- Sensitive cookies, headers, tokens, and personal form data are not persisted by CommerceGuard.
`;
}

function relativeRunPath(runDir: string, absolutePath: string): string {
  return absolutePath.startsWith(runDir)
    ? absolutePath.slice(runDir.length + 1)
    : absolutePath;
}
