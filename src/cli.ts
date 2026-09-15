import { loadJourneyConfig } from "./config/loadJourney.js";
import { runJourney } from "./runner/runJourney.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const recipePath = args[0] === "--" ? args[1] : args[0];

  if (!recipePath) {
    console.error("Usage: npm.cmd run run -- <recipe.json>");
    process.exitCode = 1;
    return;
  }

  const config = await loadJourneyConfig(recipePath);
  const result = await runJourney(config);

  console.log(JSON.stringify({
    runId: result.runId,
    journeyId: result.journeyId,
    projectId: result.projectId,
    reportGroup: result.reportGroup,
    environment: result.environment,
    status: result.status,
    productStatus: result.productStatus,
    reason: result.reason,
    attempts: result.attempts,
    recoveredByRetry: result.recoveredByRetry,
    failedStep: result.failedStep,
    runDir: result.runDir,
    error: result.error
  }, null, 2));

  if (result.productStatus !== "PASS") {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  console.log(JSON.stringify({
    runId: undefined,
    journeyId: "unknown",
    projectId: undefined,
    reportGroup: "real",
    status: "UNEXPECTED_STATE",
    productStatus: "MONITOR_FAILURE",
    reason: "Runner/config failed before journey execution.",
    attempts: 0,
    recoveredByRetry: false,
    failedStep: "load-config",
    runDir: undefined,
    error: message
  }, null, 2));

  process.exitCode = 2;
});
