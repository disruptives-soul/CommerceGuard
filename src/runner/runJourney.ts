import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import serverlessChromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import type { Browser, ConsoleMessage, Request } from "playwright-core";
import { createRunArtifacts, writeReport, writeResult } from "../evidence/artifacts.js";
import type { EvidenceEvent, JourneyAttemptResult, JourneyConfig, JourneyResult, StepResult } from "../types.js";
import { classifyError } from "./classifyResult.js";
import { executeStep } from "./executeStep.js";
import { classifyProductStatus } from "./productStatus.js";
import { waitBeforeRetry } from "./retryPolicy.js";

export async function runJourney(config: JourneyConfig): Promise<JourneyResult> {
  const artifacts = await createRunArtifacts(config.id);
  const maxAttempts = Math.max(config.retry?.attempts ?? 1, 1);
  const delayMs = config.retry?.delayMs ?? 0;
  const startedAt = new Date();

  let lastResult: JourneyResult | undefined;
  const attemptsDetail: JourneyAttemptResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptScreenshotsDir = join(artifacts.screenshotsDir, `attempt-${attempt}`);
    await mkdir(attemptScreenshotsDir, { recursive: true });

    lastResult = await runJourneyAttempt(config, attempt, startedAt, artifacts.runDir, attemptScreenshotsDir);
    attemptsDetail.push(toAttemptDetail(lastResult, attempt));
    lastResult.attemptsDetail = attemptsDetail;

    if (lastResult.status === "PASS") {
      if (attempt > 1) {
        lastResult.recoveredByRetry = true;
        lastResult.productStatus = "INCONCLUSIVE";
        lastResult.reason = "Journey recovered after a failed attempt; treat as intermittent until stability is proven.";
      }
      await writeResult(lastResult, artifacts.resultPath);
      await writeReport(lastResult, artifacts.reportPath);
      return lastResult;
    }

    if (attempt < maxAttempts && delayMs > 0) {
      await waitBeforeRetry(delayMs);
    }
  }

  if (!lastResult) {
    throw new Error("Journey did not run");
  }

  lastResult.attemptsDetail = attemptsDetail;
  await writeResult(lastResult, artifacts.resultPath);
  await writeReport(lastResult, artifacts.reportPath);
  return lastResult;
}

async function runJourneyAttempt(
  config: JourneyConfig,
  attempt: number,
  startedAt: Date,
  runDir: string,
  screenshotsDir: string
): Promise<JourneyResult> {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent:
      "CommerceGuard/0.1 (+https://drvs.com.ar; black-box journey validation)"
  });
  const page = await context.newPage();
  const evidence: EvidenceEvent[] = [];
  const steps: StepResult[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (["error", "warning"].includes(message.type())) {
      evidence.push({
        type: "console",
        message: `[${message.type()}] ${message.text()}`,
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on("pageerror", (error: Error) => {
    evidence.push({
      type: "pageerror",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  });

  page.on("requestfailed", (request: Request) => {
    evidence.push({
      type: "requestfailed",
      message: request.failure()?.errorText ?? "request failed",
      url: request.url(),
      timestamp: new Date().toISOString()
    });
  });

  try {
    for (const step of config.steps) {
      const stepStartedAt = Date.now();
      console.log("CommerceGuard step started", JSON.stringify({
        journeyId: config.id,
        attempt,
        stepId: step.id,
        action: step.action
      }));

      const result = await executeStep({
        page,
        step,
        screenshotsDir,
        navigationTimeoutMs: config.timeouts?.navigationMs ?? 20000,
        stepTimeoutMs: config.timeouts?.stepMs ?? 10000
      });

      steps.push(result);
      console.log("CommerceGuard step completed", JSON.stringify({
        journeyId: config.id,
        attempt,
        stepId: step.id,
        status: result.status,
        durationMs: Date.now() - stepStartedAt,
        currentUrl: result.currentUrl
      }));

      if (result.status === "FAIL") {
        throw new Error(result.error ?? `Step failed: ${step.id}`);
      }
    }

    const finishedAt = new Date();
    const selectedVehicle = getSelectedVehicle(steps);
    const classification = classifyProductStatus("PASS", steps);
    return {
      journeyId: config.id,
      journeyName: config.name,
      projectId: config.projectId,
      adapter: config.adapter,
      reportGroup: config.reportGroup ?? "real",
      environment: config.environment,
      status: "PASS",
      productStatus: classification.productStatus,
      reason: classification.reason,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      attempts: attempt,
      recoveredByRetry: false,
      runDir,
      steps,
      evidence,
      currentUrl: page.url(),
      selectedVehicle
    };
  } catch (error) {
    const finishedAt = new Date();
    const status = classifyError(error);
    const selectedVehicle = getSelectedVehicle(steps);
    const failedStep = steps.find((step) => step.status === "FAIL")?.id;
    const classification = classifyProductStatus(status, steps, error instanceof Error ? error.message : String(error));
    return {
      journeyId: config.id,
      journeyName: config.name,
      projectId: config.projectId,
      adapter: config.adapter,
      reportGroup: config.reportGroup ?? "real",
      environment: config.environment,
      status,
      productStatus: classification.productStatus,
      reason: classification.reason,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      attempts: attempt,
      recoveredByRetry: false,
      runDir,
      steps,
      evidence,
      failedStep,
      currentUrl: page.url(),
      selectedVehicle,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await browser.close();
  }
}

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL === "1") {
    return playwrightChromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true
    });
  }

  return playwrightChromium.launch({ headless: true });
}

function toAttemptDetail(result: JourneyResult, attempt: number): JourneyAttemptResult {
  return {
    attempt,
    status: result.status,
    productStatus: result.productStatus,
    reason: result.reason,
    durationMs: result.durationMs,
    steps: result.steps,
    evidence: result.evidence,
    failedStep: result.failedStep,
    currentUrl: result.currentUrl,
    selectedVehicle: result.selectedVehicle,
    error: result.error
  };
}

function getSelectedVehicle(steps: StepResult[]): JourneyResult["selectedVehicle"] | undefined {
  const vehicleStep = steps.find((step) =>
    step.clickedElement?.dataCg === "vehicle-detail-link" ||
    step.clickedElement?.href?.includes("/comprar/")
  );

  if (!vehicleStep?.clickedElement) {
    return undefined;
  }

  const href = vehicleStep.clickedElement.href;
  const condition = href?.match(/\/comprar\/([^/]+)\//)?.[1];

  return {
    name: vehicleStep.clickedElement.text,
    url: href,
    sku: vehicleStep.clickedElement.sku,
    condition: vehicleStep.clickedElement.condition ?? condition
  };
}
