import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { JourneyResult, ProductStatus, ReportGroup } from "../types.js";

export type ReportScope = ReportGroup | "all";

export type SchedulerEvent = {
  runId?: string;
  timestamp: string;
  projectId?: string;
  environment: string;
  jobId: string;
  journeyId: string;
  reportGroup: ReportGroup;
  status: string;
  productStatus: ProductStatus;
  reason: string;
  failedStep?: string;
  durationMs: number;
  attempts?: number;
  recoveredByRetry?: boolean;
  runDir: string;
};

export type RunMetrics = {
  totalRuns: number;
  counts: Record<ProductStatus, number>;
  averageDurationMs: number;
  p95DurationMs: number;
  flakiness: number;
  retriesRecovered: number;
  failedSteps: Array<[string, number]>;
  latestFailures: JourneyResult[];
};

export async function collectRunResults(root = "runs"): Promise<JourneyResult[]> {
  const results: JourneyResult[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;

    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

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

export async function collectSchedulerEvents(path = join("runs", "_scheduler", "events.jsonl")): Promise<SchedulerEvent[]> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SchedulerEvent);
}

export function filterRuns(results: JourneyResult[], options: { group: ReportScope; sinceHours?: number; projectId?: string; environment?: string }): JourneyResult[] {
  const minTime = options.sinceHours ? Date.now() - options.sinceHours * 60 * 60 * 1000 : undefined;

  return results.filter((result) => {
    if (options.group !== "all" && getReportGroup(result) !== options.group) {
      return false;
    }

    if (options.projectId && (result.projectId ?? inferProjectId(result)) !== options.projectId) {
      return false;
    }

    if (options.environment && result.environment !== options.environment) {
      return false;
    }

    if (minTime && new Date(result.startedAt).getTime() < minTime) {
      return false;
    }

    return true;
  });
}

export function filterSchedulerEvents(events: SchedulerEvent[], options: { sinceHours?: number; projectId?: string; environment?: string }): SchedulerEvent[] {
  const minTime = options.sinceHours ? Date.now() - options.sinceHours * 60 * 60 * 1000 : undefined;

  return events.filter((event) => {
    if (options.projectId && event.projectId !== options.projectId) {
      return false;
    }

    if (options.environment && event.environment !== options.environment) {
      return false;
    }

    if (minTime && new Date(event.timestamp).getTime() < minTime) {
      return false;
    }

    return true;
  });
}

export function buildRunMetrics(results: JourneyResult[]): RunMetrics {
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const counts: Record<ProductStatus, number> = {
    PASS: 0,
    COMMERCE_FAILURE: 0,
    MONITOR_FAILURE: 0,
    INCONCLUSIVE: 0
  };

  for (const result of results) {
    counts[getProductStatus(result)] += 1;
  }

  const retriesRecovered = results.filter((result) => result.recoveredByRetry).length;
  const nonPass = results.length - counts.PASS;

  return {
    totalRuns: results.length,
    counts,
    averageDurationMs: average(durations),
    p95DurationMs: percentile(durations, 95),
    flakiness: results.length > 0 ? (nonPass + retriesRecovered) / results.length : 0,
    retriesRecovered,
    failedSteps: countBy(
      results.filter((result) => result.failedStep),
      (result) => result.failedStep ?? "unknown"
    ),
    latestFailures: results
      .filter((result) => getProductStatus(result) !== "PASS")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 10)
  };
}

export function buildSchedulerMetrics(events: SchedulerEvent[]): RunMetrics {
  const pseudoResults = events.map((event) => ({
    journeyId: event.journeyId,
    runId: event.runId ?? event.runDir,
    journeyName: event.jobId,
    projectId: event.projectId,
    reportGroup: event.reportGroup,
    status: event.status as JourneyResult["status"],
    productStatus: event.productStatus,
    reason: event.reason,
    startedAt: event.timestamp,
    finishedAt: event.timestamp,
    durationMs: event.durationMs,
    attempts: event.attempts ?? 1,
    recoveredByRetry: Boolean(event.recoveredByRetry),
    runDir: event.runDir,
    steps: [],
    evidence: [],
    failedStep: event.failedStep
  })) satisfies JourneyResult[];

  return buildRunMetrics(pseudoResults);
}

export function metricsBlock(metrics: RunMetrics): string {
  return `- Total runs: ${metrics.totalRuns}
- PASS: ${metrics.counts.PASS}
- COMMERCE_FAILURE: ${metrics.counts.COMMERCE_FAILURE}
- MONITOR_FAILURE: ${metrics.counts.MONITOR_FAILURE}
- INCONCLUSIVE: ${metrics.counts.INCONCLUSIVE}
- Flakiness: ${Math.round(metrics.flakiness * 100)}%
- Average duration: ${metrics.averageDurationMs} ms
- p95 duration: ${metrics.p95DurationMs} ms
- Retries recovered: ${metrics.retriesRecovered}`;
}

export function failedStepsBlock(metrics: RunMetrics): string {
  return metrics.failedSteps.length > 0
    ? metrics.failedSteps.map(([step, count]) => `- ${step}: ${count}`).join("\n")
    : "- None";
}

export function latestFailuresBlock(results: JourneyResult[]): string {
  if (results.length === 0) {
    return "- None";
  }

  return results.map((result) => {
    const runDir = relative(process.cwd(), result.runDir);
    return `- ${result.startedAt} ${getProductStatus(result)} ${result.journeyId} ${result.failedStep ?? "-"}: ${escapeMarkdown(result.reason ?? result.error ?? "-")} (\`${runDir}\`)`;
  }).join("\n");
}

export function getReportGroup(result: JourneyResult): ReportGroup {
  if (result.reportGroup) {
    return result.reportGroup;
  }

  return result.journeyId.includes("failure-lab") ? "failure-lab" : "real";
}

export function getProductStatus(result: JourneyResult): ProductStatus {
  if (result.productStatus) {
    return result.productStatus;
  }

  switch (result.status) {
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

function inferProjectId(result: JourneyResult): string | undefined {
  return result.journeyId.startsWith("car-one-") ? "car-one" : undefined;
}

export function countBy<T>(items: T[], getKey: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? 0;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function escapeMarkdown(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  return value.replace(/\s+/g, " ").replace(/\|/g, "\\|").slice(0, 220);
}
