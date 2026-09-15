import { readFile } from "node:fs/promises";
import { loadJourneyConfig } from "../config/loadJourney.js";
import {
  getAlertState,
  insertSchedulerEventToSupabase,
  persistRunToSupabase,
  upsertAlertState
} from "../integrations/supabase.js";
import { notify, type NotificationConfig } from "../notifications/notify.js";
import { runJourney } from "../runner/runJourney.js";
import type { JourneyResult, ProductStatus } from "../types.js";

type SchedulerConfig = {
  projectId: string;
  environment: string;
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

export type ServerlessRunOutput = {
  projectId: string;
  environment: string;
  results: Array<{
    jobId: string;
    journeyId: string;
    productStatus: ProductStatus;
    status: JourneyResult["status"];
    durationMs: number;
    notificationSent: boolean;
    runDir: string;
  }>;
};

export async function runScheduledJourney(configPath = "configs/scheduler.car-one.staging.slack.json"): Promise<ServerlessRunOutput> {
  const config = await readSchedulerConfig(configPath);
  const results: ServerlessRunOutput["results"] = [];

  for (const job of config.jobs) {
    const journeyConfig = await loadJourneyConfig(job.recipe);
    const result = await runJourney({
      ...journeyConfig,
      projectId: journeyConfig.projectId ?? config.projectId,
      environment: journeyConfig.environment ?? config.environment
    });

    await persistRunToSupabase(result);
    const notificationSent = await maybeNotify(config, job, result);
    await insertSchedulerEventToSupabase({
      timestamp: new Date().toISOString(),
      projectId: result.projectId ?? config.projectId,
      environment: result.environment ?? config.environment,
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
      runDir: result.runDir,
      notificationSent
    });

    results.push({
      jobId: job.id,
      journeyId: result.journeyId,
      productStatus: result.productStatus,
      status: result.status,
      durationMs: result.durationMs,
      notificationSent,
      runDir: result.runDir
    });
  }

  return {
    projectId: config.projectId,
    environment: config.environment,
    results
  };
}

async function maybeNotify(config: SchedulerConfig, job: SchedulerJob, result: JourneyResult): Promise<boolean> {
  const policy = config.alertPolicy ?? {
    notifyOn: ["COMMERCE_FAILURE", "MONITOR_FAILURE"],
    minConsecutiveFailures: 2,
    notifyOnRecovery: true
  };
  const minConsecutiveFailures = Math.max(policy.minConsecutiveFailures ?? 2, 1);
  const projectId = result.projectId ?? config.projectId;
  const environment = result.environment ?? config.environment;
  const previousState = await getAlertState(projectId, environment, job.id);
  const alertable = policy.notifyOn.includes(result.productStatus);
  let notificationSent = false;

  if (alertable) {
    const consecutiveAlertable = (previousState?.consecutive_alertable ?? 0) + 1;
    const shouldNotify = consecutiveAlertable >= minConsecutiveFailures && !previousState?.last_alerted;

    if (shouldNotify) {
      notificationSent = await notify(config.notifications, {
        type: "alert",
        projectId,
        jobId: job.id,
        productStatus: result.productStatus,
        reason: result.reason,
        runDir: result.runDir,
        failedStep: result.failedStep,
        result
      });
    }

    await upsertAlertState({
      project_id: projectId,
      environment,
      job_id: job.id,
      consecutive_alertable: consecutiveAlertable,
      last_alerted: notificationSent || Boolean(previousState?.last_alerted)
    });
    return notificationSent;
  }

  if (result.productStatus === "PASS" && previousState?.last_alerted && policy.notifyOnRecovery !== false) {
    notificationSent = await notify(config.notifications, {
      type: "recovery",
      projectId,
      jobId: job.id,
      productStatus: result.productStatus,
      reason: "Journey recovered after an active alert.",
      runDir: result.runDir,
      result
    });
  }

  await upsertAlertState({
    project_id: projectId,
    environment,
    job_id: job.id,
    consecutive_alertable: 0,
    last_alerted: false
  });
  return notificationSent;
}

async function readSchedulerConfig(path: string): Promise<SchedulerConfig> {
  return JSON.parse(await readFile(path, "utf8")) as SchedulerConfig;
}
