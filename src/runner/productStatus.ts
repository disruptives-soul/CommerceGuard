import type { ProductStatus, ResultStatus, StepResult } from "../types.js";

export function classifyProductStatus(
  status: ResultStatus,
  steps: StepResult[],
  error?: string
): { productStatus: ProductStatus; reason: string } {
  if (status === "PASS") {
    return { productStatus: "PASS", reason: "Journey reached the configured stop point." };
  }

  const failedStep = steps.find((step) => step.status === "FAIL");
  const normalized = `${error ?? ""} ${failedStep?.error ?? ""}`.toLowerCase();

  if (
    normalized.includes("unsafe journey config") ||
    normalized.includes("missing environment variable") ||
    normalized.includes("invalid journey config")
  ) {
    return { productStatus: "MONITOR_FAILURE", reason: "Runner configuration or guardrail blocked execution." };
  }

  if (
    status === "AUTOMATION_BLOCKED" ||
    normalized.includes("cloudflare") ||
    normalized.includes("challenge") ||
    normalized.includes("captcha") ||
    normalized.includes("access denied") ||
    normalized.includes("forbidden") ||
    normalized.includes("rate limit")
  ) {
    return { productStatus: "INCONCLUSIVE", reason: "Automation was blocked or challenged before commerce outcome was proven." };
  }

  if (status === "TIMEOUT" || status === "NETWORK_FAILURE" || status === "EXTERNAL_SERVICE_FAILURE") {
    return { productStatus: "INCONCLUSIVE", reason: "Timeout/network/dependency failure needs evidence review before commerce classification." };
  }

  if (status === "JOURNEY_FAILURE") {
    return { productStatus: "COMMERCE_FAILURE", reason: failedStep ? `Observable journey failed at step "${failedStep.id}".` : "Observable journey failed." };
  }

  return { productStatus: "INCONCLUSIVE", reason: "Unexpected state needs review." };
}
