select
  date_trunc('day', r.created_at) as day,
  r.environment,
  count(*) as total,
  count(*) filter (where r.product_status = 'PASS') as pass,
  count(*) filter (where r.product_status = 'COMMERCE_FAILURE') as commerce_failure,
  count(*) filter (where r.product_status = 'MONITOR_FAILURE') as monitor_failure,
  count(*) filter (where r.product_status = 'INCONCLUSIVE') as inconclusive,
  avg(r.duration_ms)::int as avg_duration_ms,
  percentile_cont(0.95) within group (order by r.duration_ms)::int as p95_duration_ms,
  count(*) filter (where e.notification_sent) as notifications_sent,
  count(*) filter (where r.evidence_base_path is null) as missing_evidence
from public.commerceguard_runs r
left join public.commerceguard_scheduler_events e
  on e.run_id = r.run_id
where r.environment = 'production-no-submit'
group by 1, 2
order by 1 desc;
