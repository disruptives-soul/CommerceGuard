import { join } from "node:path";
import type { Locator, Page } from "playwright-core";
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
  let clickedElement: StepResult["clickedElement"];

  try {
    switch (step.action) {
      case "goto":
        if (!step.url) throw new Error(`Step ${step.id} requires url`);
        await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
        break;

      case "click":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        clickedElement = await describeLocator(page.locator(step.selector).first());
        await page.locator(step.selector).click({ timeout: stepTimeoutMs });
        break;

      case "clickFirst":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        clickedElement = await clickFirstVisible(page, step.selector, stepTimeoutMs, step.clickPosition);
        break;

      case "fill":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        await page.locator(step.selector).fill(step.value ?? "", { timeout: stepTimeoutMs });
        break;

      case "waitForSelector":
        if (!step.selector) throw new Error(`Step ${step.id} requires selector`);
        await waitForFirstVisible(page, step.selector, stepTimeoutMs);
        break;

      case "assertText":
        if (!step.value) throw new Error(`Step ${step.id} requires value`);
        await assertTextContains(page, step.value, stepTimeoutMs);
        break;

      case "assertUrl":
        if (!step.value) throw new Error(`Step ${step.id} requires value`);
        await assertUrlContains(page, step.value, stepTimeoutMs);
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
      currentUrl: page.url(),
      screenshot,
      clickedElement
    };
  } catch (error) {
    const screenshot = await captureStepScreenshot(page, screenshotsDir, `${step.id}-failure`, step.name);
    return {
      id: step.id,
      action: step.action,
      status: "FAIL",
      durationMs: Date.now() - started,
      currentUrl: page.url(),
      error: error instanceof Error ? error.message : String(error),
      screenshot,
      clickedElement
    };
  }
}

async function runAssertion(page: Page, assertion: Assertion, timeoutMs: number): Promise<void> {
  switch (assertion.type) {
    case "urlContains":
      await assertUrlContains(page, assertion.value, timeoutMs);
      return;

    case "textContains":
      await assertTextContains(page, assertion.value, timeoutMs);
      return;

    case "notTextContains":
      await assertTextNotContains(page, assertion.value);
      return;

    case "selectorVisible":
      await waitForFirstVisible(page, assertion.selector, timeoutMs);
      return;
  }
}

async function clickFirstVisible(
  page: Page,
  selector: string,
  timeoutMs: number,
  position?: { x: number; y: number }
): Promise<StepResult["clickedElement"]> {
  const locator = await firstVisibleLocator(page, selector, timeoutMs);
  const clickedElement = await describeLocator(locator);
  await locator.click({ timeout: timeoutMs, position });
  return clickedElement;
}

async function waitForFirstVisible(page: Page, selector: string, timeoutMs: number): Promise<void> {
  await firstVisibleLocator(page, selector, timeoutMs);
}

async function firstVisibleLocator(page: Page, selector: string, timeoutMs: number): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  const locator = page.locator(selector);

  while (Date.now() < deadline) {
    const count = await locator.count();

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);

      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`locator.waitFor: Timeout ${timeoutMs}ms exceeded while waiting for first visible "${selector}"`);
}

async function describeLocator(locator: Locator): Promise<StepResult["clickedElement"]> {
  const [text, href, dataCg, sku, condition, urlKey] = await Promise.all([
    locator.innerText({ timeout: 1000 }).catch(() => undefined),
    locator.getAttribute("href", { timeout: 1000 }).catch(() => undefined),
    locator.getAttribute("data-cg", { timeout: 1000 }).catch(() => undefined),
    locator.getAttribute("data-cg-sku", { timeout: 1000 }).catch(() => undefined),
    locator.getAttribute("data-cg-condition", { timeout: 1000 }).catch(() => undefined),
    locator.getAttribute("data-cg-url-key", { timeout: 1000 }).catch(() => undefined)
  ]);

  return {
    text: text?.replace(/\s+/g, " ").trim().slice(0, 240),
    href: href ?? undefined,
    dataCg: dataCg ?? undefined,
    sku: sku ?? undefined,
    condition: condition ?? undefined,
    urlKey: urlKey ?? undefined
  };
}

async function assertUrlContains(page: Page, expected: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (page.url().includes(expected)) {
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Assertion failed: URL "${page.url()}" does not contain "${expected}"`);
}

async function assertTextContains(page: Page, expected: string, timeoutMs: number): Promise<void> {
  const expectedText = normalizeText(expected);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const bodyText = await page.locator("body").innerText({ timeout: Math.min(1000, timeoutMs) });

    if (normalizeText(bodyText).includes(expectedText)) {
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Assertion failed: page does not contain text "${expected}"`);
}

async function assertTextNotContains(page: Page, unexpected: string): Promise<void> {
  const bodyText = await page.locator("body").innerText({ timeout: 5000 });
  if (bodyText.includes(unexpected)) {
    throw new Error(`Assertion failed: page contains unexpected text "${unexpected}"`);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
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
