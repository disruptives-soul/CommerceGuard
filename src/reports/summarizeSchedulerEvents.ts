import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildSchedulerMetrics,
  collectSchedulerEvents,
  escapeMarkdown,
  failedStepsBlock,
  filterSchedulerEvents,
  metricsBlock
} from "./reporting.js";

type Args = {
  hours: number;
  projectId?: string;
  environment?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const events = filterSchedulerEvents(await collectSchedulerEvents(), args)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const metrics = buildSchedulerMetrics(events);
  const latestFailures = events
    .filter((event) => event.productStatus !== "PASS")
    .slice(0, 10);
  const report = `# CommerceGuard Scheduler Events

Generated: ${new Date().toISOString()}

- Window: last ${args.hours} hours
- Project: ${args.projectId ?? "all"}
- Environment: ${args.environment ?? "all"}

## Metrics

${metricsBlock(metrics)}

## Failed Steps

${failedStepsBlock(metrics)}

## Latest Failures

${latestFailures.length > 0 ? latestFailures.map((event) => `- ${event.timestamp} ${event.projectId ?? "-"} ${event.environment} ${event.jobId} ${event.productStatus} ${event.failedStep ?? "-"}: ${escapeMarkdown(event.reason)} (\`${event.runDir}\`)`).join("\n") : "- None"}

## Latest Events

| Timestamp | Project | Env | Job | Product | Technical | Duration | Evidence |
| --- | --- | --- | --- | --- | --- | ---: | --- |
${events.slice(0, 50).map((event) => `| ${event.timestamp} | ${event.projectId ?? "-"} | ${event.environment} | ${event.jobId} | ${event.productStatus} | ${event.status} | ${event.durationMs} ms | \`${event.runDir}\` |`).join("\n")}
`;

  await mkdir(join("runs", "_scheduler"), { recursive: true });
  const outputName = `summary.${args.hours}h.md`;
  await writeFile(join("runs", "_scheduler", outputName), report, "utf8");
  console.log(report);
  console.log(`\nWrote runs\\_scheduler\\${outputName}`);
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
