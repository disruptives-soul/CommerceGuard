import { join } from "node:path";
import type { Page } from "playwright";
import type { Assertion, JourneyStep, StepResult } from "../types.js";

export interface ExecuteStepOptions {
  page: Page;
  step: JourneyStep;
  screenshotsDir: string;
  navigationTimeoutMs: number;
  stepTimeoutMs: number;
}

export async function executeStep(options: ExecuteStepOptions): Promise<StepResult> {
  const started = Date.now();
  const { page, step, screenshotsDir, navigationTimeoutMs, stepTimeoutMs } = options;

  try {
    switch (step.action) {
      case "goto":
        if (!step.url) throw new Error(`Step ${step.id} requires url`);
        await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
        break;

      case "click":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        await page.locator(step.selector).click({ timeout: stepTimeoutMs });
        break;

      case "fill":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        await page.locator(step.selector).fill(step.value ?? "", { timeout: stepTimeoutMs });
        break;

      case "waitForSelector":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        await page.locator(step.selector).waitFor({ state: "visible", timeout: stepTimeoutMs });
        break;

      case "assertText":
        if (!step.value) throw new Error(`Step ${step.id} requires value`);
        await assertTextContains(page, step.value, stepTimeoutMs);
        break;

      case "assertUrl":
        if (!step.value) throw new Error(`Step ${step.id} requires value`);
        assertUrlContains(page.url(), step.value);
        break;

      case "screenshot":
        break;

      default:
        throw new Error(`Unsupported action: ${step.action satisfies never}`);
    }

    if (step.assertions) {
      for (const assertion of step.assertions) {
        await runAssertion(page, assertion, stepTimeoutMs);
      }
    }

    const screenshot = await captureStepScreenshot(page, screenshotsDir, step.id, step.name);

    return {
      id: step.id,
      action: step.action,
      status: "PASS",
      durationMs: Date.now() - started,
      screenshot
    };
  } catch (error) {
    const screenshot = await captureStepScreenshot(page, screenshotsDir, `${step.id}-failure`, step.name);
    return {
      id: step.id,
      action: step.action,
      status: "FAIL",
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      screenshot
    };
  }
}

async function runAssertion(page: Page, assertion: Assertion, timeoutMs: number): Promise<void> {
  switch (assertion.type) {
    case "urlContains":
      assertUrlContains(page.url(), assertion.value);
      return;

    case "textContains":
      await assertTextContains(page, assertion.value, timeoutMs);
      return;

    case "notTextContains":
      await assertTextNotContains(page, assertion.value);
      return;

    case "selectorVisible":
      await page.locator(assertion.selector).waitFor({ state: "visible", timeout: timeoutMs });
      return;
  }
}

function assertUrlContains(currentUrl: string, expected: string): void {
  if (!currentUrl.includes(expected)) {
    throw new Error(`Assertion failed: URL "${currentUrl}" does not contain "${expected}"`);
  }
}

async function assertTextContains(page: Page, expected: string, timeoutMs: number): Promise<void> {
  const locator = page.getByText(expected, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
}

async function assertTextNotContains(page: Page, unexpected: string): Promise<void> {
  const bodyText = await page.locator("body").innerText({ timeout: 5000 });
  if (bodyText.includes(unexpected)) {
    throw new Error(`Assertion failed: page contains unexpected text "${unexpected}"`);
  }
}

async function captureStepScreenshot(
  page: Page,
  screenshotsDir: string,
  stepId: string,
  name?: string
): Promise<string> {
  const safeName = (name ?? stepId).replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const screenshotPath = join(screenshotsDir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}
