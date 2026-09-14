# Car One Staging Flakiness Sample

Fecha: 2026-09-14

## Alcance

Muestra real contra staging Car One, sin submit comercial.

Comando ejecutado:

```powershell
$env:CARONE_BASE_URL="https://stg.carone.com.ar"
pnpm.cmd run run:repeat -- recipes/car-one.template.json --count 50
```

## Resultado

- Total runs: 50
- PASS: 50
- COMMERCE_FAILURE: 0
- MONITOR_FAILURE: 0
- INCONCLUSIVE: 0
- Flakiness: 0%
- Retries recuperados: 0
- Duracion promedio: 13303 ms
- p95 duration: 20410 ms
- Failed steps: ninguno

Reporte:

```text
runs/_repeat/2026-09-14T19-10-45-878Z/summary.md
runs/_repeat/2026-09-14T19-10-45-878Z/summary.json
```

## Interpretacion

La muestra no evidencio flakiness real en staging. No hubo timeouts, Cloudflare challenge, fallas de red, fallas de selector ni recuperaciones por retry.

Los `INCONCLUSIVE` previos en reportes historicos corresponden a ejecuciones anteriores durante desarrollo, incluyendo bloqueos de red del sandbox; no pertenecen a esta muestra de 50 corridas.

## Politica de alertas validada

Se valido localmente la regla anti falsos positivos con Failure Lab `BROKEN_CTA`:

```powershell
$env:CG_MOCK_MODE="BROKEN_CTA"
pnpm.cmd run mock:car-one
pnpm.cmd run scheduler -- configs/scheduler.car-one.local-alert-test.json --cycles 2
```

Resultado esperado y observado:

- falla 1: `COMMERCE_FAILURE`, sin notificacion;
- falla 2 consecutiva: `COMMERCE_FAILURE`, emite notificacion `stdout`.

Evento de evidencia:

```text
runs/_scheduler/events.jsonl
```

## Canal webhook recomendado

Para piloto recurrente sin paging fuerte:

- usar `configs/scheduler.car-one.staging.webhook.json`;
- setear `CG_WEBHOOK_URL` con un Incoming Webhook del canal operativo acordado;
- enviar alertas livianas solo a canal/chat, sin llamada telefonica ni paging;
- mantener `minConsecutiveFailures=2`;
- no incluir datos personales, cookies, headers ni tokens en payload.

Comando:

```powershell
$env:CARONE_BASE_URL="https://stg.carone.com.ar"
$env:CG_WEBHOOK_URL="<incoming-webhook-url>"
pnpm.cmd run scheduler -- configs/scheduler.car-one.staging.webhook.json
```

## Recomendacion

CommerceGuard queda listo para piloto recurrente con alertas livianas. Mantener monitoreo inicial sin paging fuerte y revisar evidencia antes de declarar incidente formal.
