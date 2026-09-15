import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadJourneyConfig } from "../config/loadJourney.js";
import { notify, type NotificationConfig } from "../notifications/notify.js";
import { runJourney } from "../runner/runJourney.js";
import type { JourneyResult, ProductStatus } from "../types.js";

type SchedulerConfig = {
  projectId: string;
  environment: string;
  intervalMs: number;
  jobs: SchedulerJob[];
  alertPolicy?: AlertPolicy;
  notifications?: NotificationConfig;
};

type SchedulerJob = {
  id: string;
  recipe: string;
};

type AlertPolicy = {
  notifyOn: ProductStatus[];
  minConsecutiveFailures?: number;
  notifyOnRecovery?: boolean;
};

type JobState = {
  consecutiveAlertable: number;
  lastAlerted: boolean;
};

const states = new Map<string, JobState>();

async function main(): Promise<void> {
  const { configPath, once, cycles } = parseArgs(process.argv.slice(2));
  const config = await readSchedulerConfig(configPath);

  if (once || cycles === 1) {
    await runCycle(config);
    return;
  }

  console.log(`CommerceGuard scheduler started for ${config.projectId}/${config.environment}`);
  console.log(`Interval: ${config.intervalMs}ms`);

  if (cycles) {
    for (let cycle = 1; cycle <= cycles; cycle += 1) {
      await runCycle(config);

      if (cycle < cycles) {
        await sleep(config.intervalMs);
      }
    }
    return;
  }

  while (true) {
    await runCycle(config);
    await sleep(config.intervalMs);
  }
}

async function runCycle(config: SchedulerConfig): Promise<void> {
  console.log(`\nScheduler cycle ${new Date().toISOString()}`);

  for (const job of config.jobs) {
    const journeyConfig = await loadJourneyConfig(job.recipe);
    const result = await runJourney({
      ...journeyConfig,
      projectId: journeyConfig.projectId ?? config.projectId,
      environment: journeyConfig.environment ?? config.environment
    });

    await writeSchedulerEvent(config, job, result);
    await maybeNotify(config, job, result);
    console.log(`${job.id}: ${result.productStatus} (${result.status}) ${result.durationMs}ms ${result.runDir}`);
  }
}

async function maybeNotify(config: SchedulerConfig, job: SchedulerJob, result: JourneyResult): Promise<void> {
  const policy = config.alertPolicy ?? {
    notifyOn: ["COMMERCE_FAILURE", "MONITOR_FAILURE"],
    minConsecutiveFailures: 2,
    notifyOnRecovery: true
  };
  const minConsecutiveFailures = Math.max(policy.minConsecutiveFailures ?? 2, 1);
  const state = states.get(job.id) ?? { consecutiveAlertable: 0, lastAlerted: false };
  const alertable = policy.notifyOn.includes(result.productStatus);

  if (alertable) {
    state.consecutiveAlertable += 1;
    const shouldNotify = state.consecutiveAlertable >= minConsecutiveFailures && !state.lastAlerted;

    if (shouldNotify) {
      state.lastAlerted = await notify(config.notifications, {
        type: "alert",
        projectId: result.projectId ?? config.projectId,
        jobId: job.id,
        productStatus: result.productStatus,
        reason: result.reason,
        runDir: result.runDir,
        failedStep: result.failedStep,
        result
      });
    }
  } else {
    if (result.productStatus === "PASS" && state.lastAlerted && policy.notifyOnRecovery !== false) {
      await notify(config.notifications, {
        type: "recovery",
        projectId: result.projectId ?? config.projectId,
        jobId: job.id,
        productStatus: result.productStatus,
        reason: "Journey recovered after an active alert.",
        runDir: result.runDir,
        result
      });
    }

    state.consecutiveAlertable = 0;
    state.lastAlerted = false;
  }

  states.set(job.id, state);
}

async function writeSchedulerEvent(config: SchedulerConfig, job: SchedulerJob, result: JourneyResult): Promise<void> {
  const dir = join("runs", "_scheduler");
  await mkdir(dir, { recursive: true });
  const event = {
    timestamp: new Date().toISOString(),
    projectId: result.projectId ?? config.projectId,
    environment: config.environment,
    jobId: job.id,
    journeyId: result.journeyId,
    reportGroup: result.reportGroup,
    status: result.status,
    productStatus: result.productStatus,
    reason: result.reason,
    failedStep: result.failedStep,
    durationMs: result.durationMs,
    attempts: result.attempts,
    recoveredByRetry: result.recoveredByRetry,
    currentUrl: result.currentUrl,
    runDir: result.runDir
  };

  await appendFile(join(dir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

async function readSchedulerConfig(path: string): Promise<SchedulerConfig> {
  const raw = await readFile(path, "utf8");
  const config = JSON.parse(raw) as SchedulerConfig;

  if (!config.projectId || !config.environment || !Array.isArray(config.jobs) || config.jobs.length === 0) {
    throw new Error("Invalid scheduler config: projectId, environment and jobs are required");
  }

  if (!Number.isInteger(config.intervalMs) || config.intervalMs < 10_000) {
    throw new Error("Invalid scheduler config: intervalMs must be >= 10000");
  }

  return config;
}

function parseArgs(args: string[]): { configPath: string; once: boolean; cycles?: number } {
  const filtered = args[0] === "--" ? args.slice(1) : args;
  const configPath = filtered[0];
  const once = filtered.includes("--once");
  const cyclesIndex = filtered.indexOf("--cycles");
  const cycles = cyclesIndex >= 0 ? Number(filtered[cyclesIndex + 1]) : undefined;

  if (!configPath) {
    throw new Error("Usage: pnpm.cmd run scheduler -- <config.json> [--once] [--cycles N]");
  }

  if (cycles !== undefined && (!Number.isInteger(cycles) || cycles < 1)) {
    throw new Error("--cycles must be a positive integer");
  }

  return { configPath, once, cycles };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
