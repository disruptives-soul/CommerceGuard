# Deploy CommerceGuard on Vercel + Supabase

Objetivo: correr piloto recurrente sin VM propia, usando Vercel Cron y Supabase para evidencia persistente. El primer modo validado fue staging; el siguiente modo operativo es produccion no-submit.

## Arquitectura

```text
Vercel Cron daily on Hobby, */5 on Pro
  -> /api/commerceguard/run
    -> Playwright no-submit
    -> Supabase Postgres: runs, scheduler events, alert state
    -> Supabase Storage: result.json, report.md, screenshots
    -> Slack webhook para status PASS y/o alertas segun policy
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
CG_WEBHOOK_URL=https://hooks.slack.com/services/...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_EVIDENCE_BUCKET=commerceguard-evidence
CRON_SECRET=<random-secret>
CG_SCHEDULER_CONFIG=configs/scheduler.car-one.staging.slack.json
```

No usar anon key para writes server-side. Usar `service_role`, solo como secreto de Vercel.

Para produccion no-submit:

```text
CG_SCHEDULER_CONFIG=configs/scheduler.car-one.production-no-submit.slack.json
CG_PRODUCTION_NO_SUBMIT=true
```

La recipe productiva usa `https://www.carone.com.ar`, permite tambien el redirect a `https://carone.com.ar`, y corta en el modal antes de enviar datos.

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

Para produccion no-submit, el `environment` esperado es `production-no-submit` y el `jobId` esperado es `buy-interest-production-no-submit`.

## 6. Revisar evidencia

Supabase:

- Table editor -> `commerceguard_runs`
- Table editor -> `commerceguard_scheduler_events`
- Storage -> `commerceguard-evidence`

Slack:

- En la config staging actual avisa por `PASS` en cada corrida por `notifyEveryRunOn`.
- Avisa luego de 2 `COMMERCE_FAILURE` o `MONITOR_FAILURE` consecutivos.

## Nota

Si Playwright/Chromium no inicia en Vercel por limite de runtime o binario, usar Docker/VM como fallback. La ruta Vercel + Supabase ya deja la persistencia y politica listas.

Las capturas generadas por CommerceGuard enmascaran inputs sensibles comunes antes de guardar evidencia, por ejemplo nombre, telefono, email y password.
