create table if not exists public.commerceguard_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  run_id text,
  journey_id text not null,
  journey_name text not null,
  project_id text,
  adapter text,
  environment text,
  report_group text not null,
  status text not null,
  product_status text not null,
  reason text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null,
  attempts integer not null,
  recovered_by_retry boolean not null default false,
  failed_step text,
  current_url text,
  selected_vehicle jsonb,
  run_dir text not null,
  evidence_base_path text,
  result_json jsonb not null
);

alter table public.commerceguard_runs
  add column if not exists run_id text;

create index if not exists commerceguard_runs_project_env_started_idx
  on public.commerceguard_runs (project_id, environment, started_at desc);

create index if not exists commerceguard_runs_product_status_idx
  on public.commerceguard_runs (product_status);

create unique index if not exists commerceguard_runs_run_id_idx
  on public.commerceguard_runs (run_id)
  where run_id is not null;

create table if not exists public.commerceguard_scheduler_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  run_id text,
  timestamp timestamptz not null,
  project_id text not null,
  environment text not null,
  job_id text not null,
  journey_id text not null,
  report_group text not null,
  status text not null,
  product_status text not null,
  reason text not null,
  failed_step text,
  duration_ms integer not null,
  attempts integer not null,
  recovered_by_retry boolean not null default false,
  current_url text,
  run_dir text not null,
  notification_sent boolean not null default false
);

alter table public.commerceguard_scheduler_events
  add column if not exists run_id text;

create index if not exists commerceguard_scheduler_events_project_env_ts_idx
  on public.commerceguard_scheduler_events (project_id, environment, timestamp desc);

create index if not exists commerceguard_scheduler_events_run_id_idx
  on public.commerceguard_scheduler_events (run_id)
  where run_id is not null;

create table if not exists public.commerceguard_alert_state (
  project_id text not null,
  environment text not null,
  job_id text not null,
  consecutive_alertable integer not null default 0,
  last_alerted boolean not null default false,
  last_run_id text,
  last_alert_run_id text,
  updated_at timestamptz not null default now(),
  primary key (project_id, environment, job_id)
);

alter table public.commerceguard_alert_state
  add column if not exists last_run_id text,
  add column if not exists last_alert_run_id text;

insert into storage.buckets (id, name, public)
values ('commerceguard-evidence', 'commerceguard-evidence', false)
on conflict (id) do nothing;
