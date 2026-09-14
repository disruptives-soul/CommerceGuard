import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadJourneyConfig } from "../config/loadJourney.js";
import { runJourney } from "../runner/runJourney.js";
import type { JourneyResult, ProductStatus } from "../types.js";

type RepeatSummary = {
  generatedAt: string;
  journeyName: string;
  recipePath: string;
  totalRuns: number;
  counts: Record<ProductStatus, number>;
  averageDurationMs: number;
  p95DurationMs: number;
  flakiness: number;
  retriesRecovered: number;
  failedSteps: Array<[string, number]>;
  results: JourneyResult[];
};

async function main(): Promise<void> {
  const { recipePath, count } = parseArgs(process.argv.slice(2));
  const config = await loadJourneyConfig(recipePath);
  const results: JourneyResult[] = [];

  for (let index = 1; index <= count; index += 1) {
    console.log(`Run ${index}/${count}: ${config.name}`);
    const result = await runJourney(config);
    results.push(result);
    console.log(`  ${result.productStatus} (${result.status}) ${result.durationMs}ms ${result.runDir}`);
  }

  const generatedAt = new Date().toISOString();
  const summary = summarize(config.name, recipePath, generatedAt, results);
  const report = buildReport(summary);
  const outputDir = resolve("runs", "_repeat", generatedAt.replace(/[:.]/g, "-"));
  await mkdir(outputDir, { recursive: true });
  const markdownPath = join(outputDir, "summary.md");
  const jsonPath = join(outputDir, "summary.json");
  await writeFile(markdownPath, report, "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`\n${report}`);
  console.log(`\nWrote ${markdownPath}`);
  console.log(`Wrote ${jsonPath}`);
}

function parseArgs(args: string[]): { recipePath: string; count: number } {
  const filtered = args[0] === "--" ? args.slice(1) : args;
  const recipePath = filtered[0];
  const countFlagIndex = filtered.indexOf("--count");
  const count = countFlagIndex >= 0 ? Number(filtered[countFlagIndex + 1]) : 10;

  if (!recipePath) {
    throw new Error("Usage: pnpm.cmd run run:repeat -- <recipe.json> --count 50");
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new Error("--count must be a positive integer");
  }

  return { recipePath, count };
}

function summarize(journeyName: string, recipePath: string, generatedAt: string, results: JourneyResult[]): RepeatSummary {
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const counts: Record<ProductStatus, number> = {
    PASS: 0,
    COMMERCE_FAILURE: 0,
    MONITOR_FAILURE: 0,
    INCONCLUSIVE: 0
  };

  for (const result of results) {
    counts[result.productStatus] += 1;
  }

  const failedSteps = countBy(
    results.filter((result) => result.failedStep),
    (result) => result.failedStep ?? "unknown"
  );
  const retriesRecovered = results.filter((result) => result.recoveredByRetry).length;
  const nonPass = results.length - counts.PASS;
  const flakiness = results.length > 0 ? (nonPass + retriesRecovered) / results.length : 0;

  return {
    generatedAt,
    journeyName,
    recipePath,
    totalRuns: results.length,
    counts,
    averageDurationMs: Math.round(durations.reduce((sum, duration) => sum + duration, 0) / Math.max(durations.length, 1)),
    p95DurationMs: percentile(durations, 95),
    flakiness,
    retriesRecovered,
    failedSteps,
    results
  };
}

function buildReport(summary: RepeatSummary): string {
  return `# CommerceGuard Repeat Report

Generated: ${summary.generatedAt}

- Journey: ${summary.journeyName}
- Recipe: \`${summary.recipePath}\`
- Total runs: ${summary.totalRuns}
- PASS: ${summary.counts.PASS}
- COMMERCE_FAILURE: ${summary.counts.COMMERCE_FAILURE}
- MONITOR_FAILURE: ${summary.counts.MONITOR_FAILURE}
- INCONCLUSIVE: ${summary.counts.INCONCLUSIVE}
- Average duration: ${summary.averageDurationMs} ms
- p95 duration: ${summary.p95DurationMs} ms
- Flakiness: ${Math.round(summary.flakiness * 100)}%
- Retries recovered: ${summary.retriesRecovered}

## Failed Steps

${formatCounts(summary.failedSteps)}

## Evidence

| # | Status | Technical | Failed step | Duration | Recovered | Evidence |
| ---: | --- | --- | --- | ---: | --- | --- |
${summary.results.map((result, index) => `| ${index + 1} | ${result.productStatus} | ${result.status} | ${result.failedStep ?? "-"} | ${result.durationMs} ms | ${result.recoveredByRetry ? "yes" : "no"} | \`${result.runDir}\` |`).join("\n")}

## Recommendation

${buildRecommendation(summary)}
`;
}

function buildRecommendation(summary: RepeatSummary): string {
  if (summary.counts.COMMERCE_FAILURE > 0) {
    return "Not ready for alerting. Commerce failures were observed; review evidence first.";
  }

  if (summary.counts.MONITOR_FAILURE > 0 || summary.counts.INCONCLUSIVE > 0 || summary.retriesRecovered > 0) {
    return "Not ready for noisy alerting. Run scheduler pilot without paging; investigate flakiness and inconclusive runs.";
  }

  return "Ready for scheduler pilot with basic failure notification.";
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? 0;
}

function countBy<T>(items: T[], getKey: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatCounts(counts: Array<[string, number]>): string {
  return counts.length > 0
    ? counts.map(([label, count]) => `- ${label}: ${count}`).join("\n")
    : "- None";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
