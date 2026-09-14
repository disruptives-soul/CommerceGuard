# CommerceGuard Failure Lab

El Failure Lab permite validar que CommerceGuard no solo da `PASS`, sino que tambien detecta fallos comerciales observables.

## Mock local

Ejecutar todo el Failure Lab local:

```powershell
pnpm.cmd run failure-lab:car-one
```

Levantar mock:

```powershell
$env:CG_MOCK_MODE="NORMAL"
pnpm.cmd run mock:car-one
```

Ejecutar prueba segura:

```powershell
$env:CARONE_BASE_URL="http://127.0.0.1:4173"
pnpm.cmd run run -- recipes/car-one.template.json
```

Cada corrida genera:

```text
runs/<journey>/<timestamp>/result.json
runs/<journey>/<timestamp>/report.md
runs/<journey>/<timestamp>/screenshots/
```

Resumen historico de corridas:

```powershell
pnpm.cmd run report:runs 20
```

El comando imprime un resumen y escribe:

```text
runs/summary.md
```

## Modos disponibles

| Modo | Simula | Resultado esperado |
| --- | --- | --- |
| `NORMAL` | Journey funcional | `PASS` |
| `SLOW_RESPONSE` | Respuesta lenta pero dentro del timeout | `PASS` |
| `BROKEN_CTA` | Ficha sin CTA de interes | `JOURNEY_FAILURE` |
| `EMPTY_RESULT` | Listado sin autos elegibles | `JOURNEY_FAILURE` |
| `BROKEN_PRICE` | Ficha sin precio comercial | `JOURNEY_FAILURE` |
| `API_500` | Error visible en listado | `JOURNEY_FAILURE` |
| `API_TIMEOUT` | Respuesta mas lenta que timeout de navegacion | `INCONCLUSIVE` como clasificacion producto |
| `JS_EXCEPTION` | Error JS en ficha | Debe quedar en evidencia como `pageerror`; si rompe CTA, `JOURNEY_FAILURE` |

## Comandos rapidos

En una terminal:

```powershell
$env:CG_MOCK_MODE="BROKEN_CTA"
pnpm.cmd run mock:car-one
```

En otra:

```powershell
$env:CARONE_BASE_URL="http://127.0.0.1:4173"
pnpm.cmd run run -- recipes/car-one.template.json
```

Repetir cambiando `CG_MOCK_MODE`.

## Interpretacion producto

Mapping inicial:

```text
PASS -> PASS
JOURNEY_FAILURE -> COMMERCE_FAILURE
config/runner/guardrail failure -> MONITOR_FAILURE
Cloudflare/challenge/timeout/network/ambiguous -> INCONCLUSIVE
```

El objetivo no es demostrar que cada dependencia interna fallo, sino que un usuario real no pudo completar el journey observable hasta el punto de STOP.
