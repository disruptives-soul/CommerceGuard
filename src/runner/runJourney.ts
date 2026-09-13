import { chromium } from "playwright";
import { createRunArtifacts, writeResult } from "../evidence/artifacts.js";
import type { EvidenceEvent, JourneyConfig, JourneyResult, StepResult } from "../types.js";
import { classifyError } from "./classifyResult.js";
import { executeStep } from "./executeStep.js";
import { waitBeforeRetry } from "./retryPolicy.js";

export async function runJourney(config: JourneyConfig): Promise<JourneyResult> {
  const artifacts = await createRunArtifacts(config.id);
  const maxAttempts = Math.max(config.retry?.attempts ?? 1, 1);
  const delayMs = config.retry?.delayMs ?? 0;
  const startedAt = new Date();

  let lastResult: JourneyResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = await runJourneyAttempt(config, attempt, startedAt, artifacts.runDir, artifacts.screenshotsDir);

    if (lastResult.status === "PASS") {
      await writeResult(lastResult, artifacts.resultPath);
      return lastResult;
    }

    if (attempt < maxAttempts && delayMs > 0) {
      await waitBeforeRetry(delayMs);
    }
  }

  if (!lastResult) {
    throw new Error("Journey did not run");
  }

  await writeResult(lastResult, artifacts.resultPath);
  return lastResult;
}

async function runJourneyAttempt(
  config: JourneyConfig,
  attempt: number,
  startedAt: Date,
  runDir: string,
  screenshotsDir: string
): Promise<JourneyResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent:
      "CommerceGuard/0.1 (+https://drvs.com.ar; black-box journey validation)"
  });
  const page = await context.newPage();
  const evidence: EvidenceEvent[] = [];
  const steps: StepResult[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      evidence.push({
        type: "console",
        message: `[${message.type()}] ${message.text()}`,
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on("pageerror", (error) => {
    evidence.push({
      type: "pageerror",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  });

  page.on("requestfailed", (request) => {
    evidence.push({
      type: "requestfailed",
      message: request.failure()?.errorText ?? "request failed",
      url: request.url(),
      timestamp: new Date().toISOString()
    });
  });

  try {
    for (const step of config.steps) {
      const result = await executeStep({
        page,
        step,
        screenshotsDir,
        navigationTimeoutMs: config.timeouts?.navigationMs ?? 20000,
        stepTimeoutMs: config.timeouts?.stepMs ?? 10000
      });

      steps.push(result);

      if (result.status === "FAIL") {
        throw new Error(result.error ?? `Step failed: ${step.id}`);
      }
    }

    const finishedAt = new Date();
    return {
      journeyId: config.id,
      journeyName: config.name,
      status: "PASS",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      attempts: attempt,
      runDir,
      steps,
      evidence
    };
  } catch (error) {
    const finishedAt = new Date();
    return {
      journeyId: config.id,
      journeyName: config.name,
      status: classifyError(error),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      attempts: attempt,
      runDir,
      steps,
      evidence,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await browser.close();
  }
}
