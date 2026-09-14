import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { JourneyResult, ReportGroup } from "../types.js";

type RunSummary = {
  journeyId: string;
  projectId?: string;
  adapter?: string;
  reportGroup: ReportGroup;
  status: string;
  productStatus: string;
  startedAt: string;
  durationMs: number;
  attempts: number;
  recoveredByRetry: boolean;
  failedStep?: string;
  reason: string;
  selectedVehicleName?: string;
  selectedVehicleUrl?: string;
  runDir: string;
};

type ReportArgs = {
  limit: number;
  group: ReportGroup | "all";
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const results = await collectResults("runs");
  const summaries = results
    .filter((result) => args.group === "all" || getReportGroup(result) === args.group)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, args.limit)
    .map(toSummary);

  const totalInGroup = results.filter((result) => args.group === "all" || getReportGroup(result) === args.group).length;
  const report = buildReport(summaries, totalInGroup, args.group);
  const outputName = args.group === "all" ? "summary.md" : `summary.${args.group}.md`;
  await writeFile(join("runs", outputName), report, "utf8");

  console.log(report);
  console.log(`\nWrote runs\\${outputName}`);
}

async function collectResults(root: string): Promise<JourneyResult[]> {
  const results: JourneyResult[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === "result.json") {
        const raw = await readFile(fullPath, "utf8");
        results.push(JSON.parse(raw) as JourneyResult);
      }
    }
  }

  await walk(root);
  return results;
}

function toSummary(result: JourneyResult): RunSummary {
  const failedStep = result.steps.find((step) => step.status === "FAIL");

  return {
    journeyId: result.journeyId,
    projectId: result.projectId ?? inferProjectId(result),
    adapter: result.adapter ?? inferAdapter(result),
    reportGroup: getReportGroup(result),
    status: result.status,
    productStatus: result.productStatus ?? legacyProductStatus(result.status),
    startedAt: result.startedAt,
    durationMs: result.durationMs,
    attempts: result.attempts,
    recoveredByRetry: Boolean(result.recoveredByRetry),
    failedStep: result.failedStep ?? failedStep?.id,
    reason: result.reason ?? result.error ?? "-",
    selectedVehicleName: result.selectedVehicle?.name,
    selectedVehicleUrl: result.selectedVehicle?.url,
    runDir: relative(process.cwd(), result.runDir)
  };
}

function buildReport(summaries: RunSummary[], totalRuns: number, group: ReportGroup | "all"): string {
  const passCount = summaries.filter((run) => run.productStatus === "PASS").length;
  const passRate = summaries.length > 0 ? Math.round((passCount / summaries.length) * 100) : 0;
  const statusLines = countBy(summaries, (run) => run.status);
  const productStatusLines = countBy(summaries, (run) => run.productStatus);
  const failedStepLines = countBy(
    summaries.filter((run) => run.failedStep),
    (run) => run.failedStep ?? "unknown"
  );
  const conclusion = buildConclusion(summaries);

  return `# CommerceGuard Runs Summary

Generated: ${new Date().toISOString()}

Report group: ${group}

Showing latest ${summaries.length} of ${totalRuns} runs.

## Health

- Pass rate: ${passRate}%
- Pass: ${passCount}
- Non-pass: ${summaries.length - passCount}
- Retry recoveries: ${summaries.filter((run) => run.recoveredByRetry).length}

## Status Counts

${formatCounts(statusLines)}

## Product Classification Counts

${formatCounts(productStatusLines)}

## Failed Steps

${formatCounts(failedStepLines)}

## Conclusion

${conclusion}

## Latest Runs

| Started | Project | Group | Journey | Status | Product | Failed step | Reason | Duration | Attempts | Vehicle | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
${summaries.map((run) => `| ${run.startedAt} | ${run.projectId ?? "-"} | ${run.reportGroup} | ${run.journeyId} | ${run.status} | ${run.productStatus} | ${run.failedStep ?? "-"} | ${escapeTable(run.reason)} | ${run.durationMs} ms | ${run.attempts}${run.recoveredByRetry ? " recovered" : ""} | ${escapeTable(run.selectedVehicleName ?? run.selectedVehicleUrl ?? "-")} | \`${run.runDir}\` |`).join("\n")}
`;
}

function parseArgs(args: string[]): ReportArgs {
  const filtered = args[0] === "--" ? args.slice(1) : args;
  let limit = 20;
  let group: ReportGroup | "all" = "all";

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

    if (/^\d+$/.test(arg ?? "")) {
      limit = Number(arg);
    }
  }

  return { limit, group };
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
  if (counts.length === 0) {
    return "- None";
  }

  return counts.map(([label, count]) => `- ${label}: ${count}`).join("\n");
}

function legacyProductStatus(status: JourneyResult["status"]): string {
  switch (status) {
    case "PASS":
      return "PASS";
    case "JOURNEY_FAILURE":
      return "COMMERCE_FAILURE";
    case "AUTOMATION_BLOCKED":
      return "MONITOR_FAILURE";
    case "TIMEOUT":
    case "NETWORK_FAILURE":
    case "UNEXPECTED_STATE":
    case "EXTERNAL_SERVICE_FAILURE":
      return "INCONCLUSIVE";
  }
}

function getReportGroup(result: JourneyResult): ReportGroup {
  if (result.reportGroup) {
    return result.reportGroup;
  }

  return result.journeyId.includes("failure-lab") ? "failure-lab" : "real";
}

function inferProjectId(result: JourneyResult): string | undefined {
  return result.journeyId.startsWith("car-one-") ? "car-one" : undefined;
}

function inferAdapter(result: JourneyResult): string | undefined {
  return result.journeyId.startsWith("car-one-") ? "car-one" : undefined;
}

function buildConclusion(summaries: RunSummary[]): string {
  if (summaries.length === 0) {
    return "No runs available.";
  }

  const commerceFailures = summaries.filter((run) => run.productStatus === "COMMERCE_FAILURE").length;
  const monitorFailures = summaries.filter((run) => run.productStatus === "MONITOR_FAILURE").length;
  const inconclusive = summaries.filter((run) => run.productStatus === "INCONCLUSIVE").length;
  const pass = summaries.filter((run) => run.productStatus === "PASS").length;
  const recovered = summaries.filter((run) => run.recoveredByRetry).length;

  if (commerceFailures === 0 && monitorFailures === 0 && inconclusive === 0) {
    return `Stable sample: ${pass}/${summaries.length} runs passed. Ready for scheduler pilot.`;
  }

  if (commerceFailures > 0) {
    return `Commerce failures detected: ${commerceFailures}/${summaries.length}. Review failed steps and screenshots before scheduling.`;
  }

  if (monitorFailures > 0 || inconclusive > 0) {
    return `Monitoring instability detected: ${monitorFailures} monitor failures, ${inconclusive} inconclusive runs, ${recovered} retry recoveries. Harden runner/environment before alerting.`;
  }

  return "Mixed sample; review evidence before scheduling.";
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 160);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
