# Deploy CommerceGuard on Vercel + Supabase

Objetivo: correr piloto recurrente staging sin VM propia, usando Vercel Cron y Supabase para evidencia persistente.

## Arquitectura

```text
Vercel Cron daily on Hobby, */5 on Pro
  -> /api/commerceguard/run
    -> Playwright no-submit
    -> Supabase Postgres: runs, scheduler events, alert state
    -> Supabase Storage: result.json, report.md, screenshots
    -> Slack webhook si hay 2 fallas consecutivas
```

## Requisitos

- Vercel Pro para cron cada 5 minutos. En Hobby, Vercel Cron solo permite una ejecucion diaria.
- Supabase project.
- Slack Incoming Webhook.

## 1. Supabase

En Supabase SQL Editor ejecutar:

```sql
-- ver supabase/schema.sql
```

Archivo:

```text
supabase/schema.sql
```

Crea:

- `commerceguard_runs`
- `commerceguard_scheduler_events`
- `commerceguard_alert_state`
- bucket privado `commerceguard-evidence`

## 2. Vercel env vars

Configurar en Vercel Project Settings -> Environment Variables:

```text
CARONE_BASE_URL=https://stg.carone.com.ar
CG_WEBHOOK_URL=https://hooks.slack.com/services/...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_EVIDENCE_BUCKET=commerceguard-evidence
CRON_SECRET=<random-secret>
CG_SCHEDULER_CONFIG=configs/scheduler.car-one.staging.slack.json
```

No usar anon key para writes server-side. Usar `service_role`, solo como secreto de Vercel.

## 3. Vercel cron

Configurado en:

```text
vercel.json
```

Cron compatible con Vercel Hobby:

```json
{
  "path": "/api/commerceguard/run",
  "schedule": "0 13 * * *"
}
```

`0 13 * * *` corre una vez por dia a las 13:00 UTC, 10:00 Buenos Aires. Para piloto cada 5 minutos usar Vercel Pro o el despliegue Docker/VM.

Endpoint:

```text
/api/commerceguard/run
```

## 4. Deploy

```powershell
git add .
git commit -m "Add Vercel Supabase pilot runtime"
git push origin main
```

Conectar repo en Vercel o redeploy si ya esta conectado.

## 5. Test manual

Desde Vercel Functions o con curl:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<vercel-domain>/api/commerceguard/run
```

Esperado:

```json
{
  "projectId": "car-one",
  "environment": "staging",
  "results": [
    {
      "jobId": "buy-interest-staging",
      "productStatus": "PASS"
    }
  ]
}
```

## 6. Revisar evidencia

Supabase:

- Table editor -> `commerceguard_runs`
- Table editor -> `commerceguard_scheduler_events`
- Storage -> `commerceguard-evidence`

Slack:

- No avisa por `PASS`.
- Avisa luego de 2 `COMMERCE_FAILURE` o `MONITOR_FAILURE` consecutivos.

## Nota

Si Playwright/Chromium no inicia en Vercel por limite de runtime o binario, usar Docker/VM como fallback. La ruta Vercel + Supabase ya deja la persistencia y politica listas.
