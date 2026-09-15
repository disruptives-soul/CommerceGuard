import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { JourneyResult, ProductStatus, ReportGroup } from "../types.js";

export type SupabaseSchedulerEvent = {
  timestamp: string;
  projectId: string;
  environment: string;
  jobId: string;
  journeyId: string;
  reportGroup: ReportGroup;
  status: string;
  productStatus: ProductStatus;
  reason: string;
  failedStep?: string;
  durationMs: number;
  attempts: number;
  recoveredByRetry: boolean;
  currentUrl?: string;
  runDir: string;
  notificationSent?: boolean;
};

export type AlertState = {
  project_id: string;
  environment: string;
  job_id: string;
  consecutive_alertable: number;
  last_alerted: boolean;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function persistRunToSupabase(result: JourneyResult): Promise<{ evidenceBasePath?: string }> {
  if (!hasSupabaseConfig()) {
    return {};
  }

  const config = getConfig();
  const evidenceBasePath = await uploadRunArtifacts(config, result);
  await insertRun(config, result, evidenceBasePath);
  return { evidenceBasePath };
}

export async function insertSchedulerEventToSupabase(event: SupabaseSchedulerEvent): Promise<void> {
  if (!hasSupabaseConfig()) {
    return;
  }

  const config = getConfig();
  await restRequest(config, "commerceguard_scheduler_events", {
    timestamp: event.timestamp,
    project_id: event.projectId,
    environment: event.environment,
    job_id: event.jobId,
    journey_id: event.journeyId,
    report_group: event.reportGroup,
    status: event.status,
    product_status: event.productStatus,
    reason: event.reason,
    failed_step: event.failedStep ?? null,
    duration_ms: event.durationMs,
    attempts: event.attempts,
    recovered_by_retry: event.recoveredByRetry,
    current_url: event.currentUrl ?? null,
    run_dir: event.runDir,
    notification_sent: Boolean(event.notificationSent)
  });
}

export async function getAlertState(projectId: string, environment: string, jobId: string): Promise<AlertState | undefined> {
  if (!hasSupabaseConfig()) {
    return undefined;
  }

  const config = getConfig();
  const query = new URL(`${config.url}/rest/v1/commerceguard_alert_state`);
  query.searchParams.set("project_id", `eq.${projectId}`);
  query.searchParams.set("environment", `eq.${environment}`);
  query.searchParams.set("job_id", `eq.${jobId}`);
  query.searchParams.set("limit", "1");

  const response = await fetch(query, {
    headers: authHeaders(config)
  });

  if (!response.ok) {
    throw new Error(`Supabase alert state read failed: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json() as AlertState[];
  return rows[0];
}

export async function upsertAlertState(state: AlertState): Promise<void> {
  if (!hasSupabaseConfig()) {
    return;
  }

  const config = getConfig();
  const url = `${config.url}/rest/v1/commerceguard_alert_state?on_conflict=project_id,environment,job_id`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(config),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      project_id: state.project_id,
      environment: state.environment,
      job_id: state.job_id,
      consecutive_alertable: state.consecutive_alertable,
      last_alerted: state.last_alerted,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase alert state upsert failed: ${response.status} ${await response.text()}`);
  }
}

async function insertRun(config: SupabaseConfig, result: JourneyResult, evidenceBasePath?: string): Promise<void> {
  await restRequest(config, "commerceguard_runs", {
    journey_id: result.journeyId,
    journey_name: result.journeyName,
    project_id: result.projectId ?? null,
    adapter: result.adapter ?? null,
    environment: result.environment ?? null,
    report_group: result.reportGroup,
    status: result.status,
    product_status: result.productStatus,
    reason: result.reason,
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    duration_ms: result.durationMs,
    attempts: result.attempts,
    recovered_by_retry: result.recoveredByRetry,
    failed_step: result.failedStep ?? null,
    current_url: result.currentUrl ?? null,
    selected_vehicle: result.selectedVehicle ?? null,
    run_dir: result.runDir,
    evidence_base_path: evidenceBasePath ?? null,
    result_json: result
  });
}

async function uploadRunArtifacts(config: SupabaseConfig, result: JourneyResult): Promise<string | undefined> {
  const basePath = `${result.projectId ?? "unknown"}/${result.environment ?? "unknown"}/${result.journeyId}/${basename(result.runDir)}`;
  const files = await listFiles(result.runDir);

  for (const filePath of files) {
    const storagePath = `${basePath}/${relative(result.runDir, filePath).replace(/\\/g, "/")}`;
    const body = await readFile(filePath);
    await uploadObject(config, storagePath, body, contentTypeFor(filePath));
  }

  return basePath;
}

async function listFiles(dir: string): Promise<string[]> {
  const output: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...await listFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      output.push(fullPath);
    }
  }

  return output;
}

async function uploadObject(config: SupabaseConfig, path: string, body: Buffer, contentType: string): Promise<void> {
  const url = buildStorageObjectUrl(config, path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": contentType,
      "x-upsert": "true"
    },
    body: new Uint8Array(body)
  });

  if (!response.ok) {
    throw new Error(`Supabase storage upload failed: ${response.status} ${await response.text()}`);
  }
}

function buildStorageObjectUrl(config: SupabaseConfig, path: string): string {
  const encodedBucket = encodeURIComponent(cleanPathSegment(config.bucket, "bucket"));
  const encodedPath = encodeStoragePath(path);
  return `${config.url}/storage/v1/object/${encodedBucket}/${encodedPath}`;
}

function encodeStoragePath(path: string): string {
  const segments = path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => cleanPathSegment(segment, "path"))
    .map(encodeURIComponent);

  return segments.join("/");
}

function cleanPathSegment(segment: string, label: string): string {
  const trimmed = segment.trim();

  if (!trimmed || trimmed === "." || trimmed === "..") {
    throw new Error(`Invalid Supabase storage ${label} segment`);
  }

  return trimmed;
}

async function restRequest(config: SupabaseConfig, table: string, body: unknown): Promise<void> {
  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...authHeaders(config),
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Supabase insert ${table} failed: ${response.status} ${await response.text()}`);
  }
}

function authHeaders(config: SupabaseConfig): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`
  };
}

function getConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey,
    bucket: process.env.SUPABASE_EVIDENCE_BUCKET ?? "commerceguard-evidence"
  };
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".png")) {
    return "image/png";
  }

  if (path.endsWith(".json")) {
    return "application/json";
  }

  if (path.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }

  return "application/octet-stream";
}
