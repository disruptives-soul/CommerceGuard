import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildRunMetrics,
  collectRunResults,
  failedStepsBlock,
  filterRuns,
  latestFailuresBlock,
  metricsBlock,
  type ReportScope
} from "./reporting.js";

type Args = {
  group: ReportScope;
  hours: number;
  projectId?: string;
  environment?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const results = filterRuns(await collectRunResults(), {
    group: args.group,
    sinceHours: args.hours,
    projectId: args.projectId,
    environment: args.environment
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const metrics = buildRunMetrics(results);
  const report = `# CommerceGuard Window Report

Generated: ${new Date().toISOString()}

- Window: last ${args.hours} hours
- Report group: ${args.group}
- Project: ${args.projectId ?? "all"}
- Environment: ${args.environment ?? "all"}

## Metrics

${metricsBlock(metrics)}

## Failed Steps

${failedStepsBlock(metrics)}

## Latest Failures

${latestFailuresBlock(metrics.latestFailures)}
`;

  await mkdir("runs", { recursive: true });
  const outputName = `summary.${args.group}.${args.hours}h.md`;
  await writeFile(join("runs", outputName), report, "utf8");
  console.log(report);
  console.log(`\nWrote runs\\${outputName}`);
}

function parseArgs(args: string[]): Args {
  const filtered = args[0] === "--" ? args.slice(1) : args;
  let group: ReportScope = "real";
  let hours = 24;
  let projectId: string | undefined;
  let environment: string | undefined;

  for (let index = 0; index < filtered.length; index += 1) {
    const arg = filtered[index];

    if (arg === "--group") {
      const value = filtered[index + 1];
      if (value !== "real" && value !== "failure-lab" && value !== "all") {
        throw new Error("--group must be one of: all, real, failure-lab");
      }
      group = value;
      index += 1;
      continue;
    }

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

  return { group, hours, projectId, environment };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
