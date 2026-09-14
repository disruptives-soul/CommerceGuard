# Vercel Env + Cloudflare Setup

## Vercel Environment Variables

En Vercel -> Project -> Settings -> Environment Variables, agregar:

```text
CARONE_BASE_URL=https://stg.carone.com.ar
CG_SCHEDULER_CONFIG=configs/scheduler.car-one.staging.slack.json
SUPABASE_EVIDENCE_BUCKET=commerceguard-evidence
```

Secretos:

```text
CG_WEBHOOK_URL=<slack incoming webhook url>
SUPABASE_URL=<supabase project url>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
CRON_SECRET=<random long secret>
```

Aplicar a:

```text
Production
Preview
```

Luego hacer redeploy para que Vercel tome las variables.

## Supabase

Ejecutar en SQL Editor:

```text
supabase/schema.sql
```

Confirmar:

- bucket `commerceguard-evidence`;
- tabla `commerceguard_runs`;
- tabla `commerceguard_scheduler_events`;
- tabla `commerceguard_alert_state`.

## Cloudflare DNS hacia Vercel

Si el dominio/subdominio vive en Cloudflare y queres que apunte al deploy de Vercel:

1. En Vercel -> Project -> Settings -> Domains, agregar el dominio o subdominio.
2. Vercel va a mostrar el registro DNS requerido.
3. En Cloudflare -> DNS, crear el registro indicado.

Para subdominio suele ser:

```text
Type: CNAME
Name: commerceguard
Target: cname.vercel-dns.com
Proxy status: DNS only
```

Para dominio raiz, seguir exactamente lo que muestre Vercel. Normalmente usa `A` record o flattening.

## Cloudflare Proxy

Para API/Cron de Vercel, empezar con:

```text
Proxy status: DNS only
```

Cuando el dominio ya resuelva y el cron funcione, se puede evaluar activar proxy naranja. Para el piloto conviene reducir variables y evitar que Cloudflare agregue challenge, cache o WAF sobre:

```text
/api/commerceguard/run
```

Si se activa proxy naranja, crear regla en Cloudflare:

```text
Path: /api/commerceguard/run
Cache: Bypass
Security/WAF challenge: Skip
Bot fight/challenge: Skip
```

## Test Endpoint

Con `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<vercel-domain>/api/commerceguard/run
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

## Notas de seguridad

- No guardar Slack webhook ni service role key en git.
- Rotar el webhook de Slack si fue pegado en chats.
- `SUPABASE_SERVICE_ROLE_KEY` solo debe vivir como secreto server-side.
- Mantener no-submit en staging.
