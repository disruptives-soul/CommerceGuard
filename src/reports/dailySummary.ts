import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildRunMetrics,
  buildSchedulerMetrics,
  collectRunResults,
  collectSchedulerEvents,
  failedStepsBlock,
  filterRuns,
  filterSchedulerEvents,
  latestFailuresBlock,
  metricsBlock
} from "./reporting.js";

type Args = {
  hours: number;
  projectId?: string;
  environment?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const allRuns = await collectRunResults();
  const realRuns = filterRuns(allRuns, {
    group: "real",
    sinceHours: args.hours,
    projectId: args.projectId,
    environment: args.environment
  });
  const labRuns = filterRuns(allRuns, {
    group: "failure-lab",
    sinceHours: args.hours,
    projectId: args.projectId,
    environment: args.environment
  });
  const schedulerEvents = filterSchedulerEvents(await collectSchedulerEvents(), {
    sinceHours: args.hours,
    projectId: args.projectId,
    environment: args.environment
  });
  const realMetrics = buildRunMetrics(realRuns);
  const labMetrics = buildRunMetrics(labRuns);
  const schedulerMetrics = buildSchedulerMetrics(schedulerEvents);
  const recommendation = buildRecommendation(realMetrics, schedulerMetrics);
  const report = `# CommerceGuard Daily Ops Summary

Generated: ${new Date().toISOString()}

- Window: last ${args.hours} hours
- Project: ${args.projectId ?? "all"}
- Environment: ${args.environment ?? "all"}

## Real Runs

${metricsBlock(realMetrics)}

### Real Failed Steps

${failedStepsBlock(realMetrics)}

### Real Latest Failures

${latestFailuresBlock(realMetrics.latestFailures)}

## Failure Lab

${metricsBlock(labMetrics)}

## Scheduler Events

${metricsBlock(schedulerMetrics)}

### Scheduler Failed Steps

${failedStepsBlock(schedulerMetrics)}

## Recommendation

${recommendation}
`;

  await mkdir(join("runs", "daily"), { recursive: true });
  const outputName = `${new Date().toISOString().slice(0, 10)}.md`;
  await writeFile(join("runs", "daily", outputName), report, "utf8");
  await writeFile(join("runs", "daily.md"), report, "utf8");
  console.log(report);
  console.log(`\nWrote runs\\daily\\${outputName}`);
  console.log("Wrote runs\\daily.md");
}

function buildRecommendation(realMetrics: ReturnType<typeof buildRunMetrics>, schedulerMetrics: ReturnType<typeof buildSchedulerMetrics>): string {
  if (realMetrics.counts.COMMERCE_FAILURE > 0) {
    return "Review immediately. Commerce failures were observed in real runs; inspect evidence before declaring incident.";
  }

  if (realMetrics.counts.MONITOR_FAILURE > 0) {
    return "Review monitor health before trusting alerts. Monitor failures appeared in real runs.";
  }

  if (schedulerMetrics.counts.COMMERCE_FAILURE > 0 || schedulerMetrics.counts.MONITOR_FAILURE > 0) {
    return "Scheduler observed alertable failures. Keep lightweight alerting and require human evidence review.";
  }

  if (realMetrics.counts.INCONCLUSIVE > 0) {
    return "No commerce failure observed, but inconclusive runs need evidence review. Do not page strongly.";
  }

  return "Healthy for staging pilot. Continue lightweight webhook alerts and human review; no strong paging yet.";
}

function parseArgs(args: string[]): Args {
  const filtered = args[0] === "--" ? args.slice(1) : args;
  let hours = 24;
  let projectId: string | undefined;
  let environment: string | undefined;

  for (let index = 0; index < filtered.length; index += 1) {
    const arg = filtered[index];

    if (arg === "--hours") {
      hours = Number(filtered[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--project") {
      projectId = filtered[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--env") {
      environment = filtered[index + 1];
      index += 1;
    }
  }

  if (!Number.isInteger(hours) || hours < 1) {
    throw new Error("--hours must be a positive integer");
  }

  return { hours, projectId, environment };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
