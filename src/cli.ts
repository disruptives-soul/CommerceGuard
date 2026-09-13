import { loadJourneyConfig } from "./config/loadJourney.js";
import { runJourney } from "./runner/runJourney.js";

async function main(): Promise<void> {
  const recipePath = process.argv[2];

  if (!recipePath) {
    console.error("Usage: npm.cmd run run -- <recipe.json>");
    process.exitCode = 1;
    return;
  }

  const config = await loadJourneyConfig(recipePath);
  const result = await runJourney(config);

  console.log(JSON.stringify({
    journeyId: result.journeyId,
    status: result.status,
    attempts: result.attempts,
    runDir: result.runDir,
    error: result.error
  }, null, 2));

  if (result.status !== "PASS") {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
