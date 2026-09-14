# CommerceGuard Runner

CommerceGuard es un monitor black-box para journeys comerciales criticos. No mira si un sitio responde `200`; valida si el flujo que vende o genera leads sigue funcionando desde la mirada de un usuario real.

Este primer MVP no incluye IA, dashboard ni multi-tenant. Es un runner tecnico para validar si el core funciona antes de convertirlo en SaaS.

## Que hace

- Abre un navegador real con Playwright.
- Ejecuta una receta de journey.
- Captura screenshots, errores de consola y requests fallidos.
- Reintenta antes de declarar falla.
- Genera un `result.json` con clasificacion y evidencia.
- Permite cortar antes de acciones irreversibles como pagos, reservas, compras o envios reales.

## Instalar

```bash
pnpm install
pnpm exec playwright install chromium
```

El proyecto usa `pnpm` como package manager.

## Ejecutar ejemplo

```bash
pnpm run run:example
```

Tambien se puede pasar una receta:

```bash
pnpm run run -- recipes/car-one.template.json
```

## Ejecutar Magento local

Primero definir las URLs del entorno Magento:

```powershell
$env:MAGENTO_BASE_URL="http://magento.local"
$env:MAGENTO_PRODUCT_URL="http://magento.local/commerceguard-test-product.html"
pnpm run run -- recipes/magento-local.template.json
```

El brief para preparar el entorno esta en `docs/magento-backend-agent-request.md`.

## Discovery Car One

CommerceGuard debe validarse primero como black-box sobre el journey real del usuario. El acceso al codigo de Car One puede usarse como apoyo white-box para entender el flujo y crear fallos controlados, pero no debe ser requisito permanente del producto.

Documentos utiles:

- `docs/technical-discovery-plan.md`
- `docs/carone-code-request.md`
- `docs/carone-frontend-discovery-report.md`
- `docs/carone-commerceguard-v01.md`
- `docs/failure-lab.md`
- `docs/v0.2-runner.md`

## Resultado

Cada corrida escribe evidencia en:

```text
runs/<journey-id>/<timestamp>/
```

Archivos principales:

- `result.json`: resumen estructurado.
- `screenshots/*.png`: capturas por step.

## Clasificacion v0.2

Cada corrida conserva un `status` tecnico para debug y expone un `productStatus` para tomar decisiones:

- `PASS`: el journey llego al STOP configurado.
- `COMMERCE_FAILURE`: el journey comercial observable fallo.
- `MONITOR_FAILURE`: fallo el runner, config, receta, guardrail o entorno.
- `INCONCLUSIVE`: timeout, red, challenge, bloqueo ambiguo o retry recuperado.

Comandos utiles:

```powershell
pnpm.cmd run run -- recipes/car-one.template.json
pnpm.cmd run run:repeat -- recipes/car-one.template.json --count 20
pnpm.cmd run report:runs 20
pnpm.cmd run report:real -- 20
pnpm.cmd run report:failure-lab -- 20
pnpm.cmd run report:window -- --group real --hours 24 --project car-one --env staging
pnpm.cmd run report:scheduler -- --hours 24 --project car-one --env staging
pnpm.cmd run report:daily -- --hours 24 --project car-one --env staging
```

Submit controlado solo se permite en local/staging con guardrails:

```powershell
$env:CARONE_BASE_URL="https://stg.carone.com.ar"
$env:CG_ALLOW_SUBMIT="true"
$env:CG_TEST_LEAD_NAME="neoh lugo"
$env:CG_TEST_LEAD_PHONE="1124037999"
pnpm.cmd run run -- recipes/car-one.submit-controlled.template.json
```

## Scheduler piloto

Scheduler local una sola corrida:

```powershell
pnpm.cmd run mock:car-one
pnpm.cmd run scheduler -- configs/scheduler.car-one.local.json --once
```

Scheduler staging:

```powershell
$env:CARONE_BASE_URL="https://stg.carone.com.ar"
$env:CG_WEBHOOK_URL="<slack-incoming-webhook-url>"
pnpm.cmd run scheduler -- configs/scheduler.car-one.staging.slack.json
```

La politica default alerta solo por `COMMERCE_FAILURE` y `MONITOR_FAILURE` despues de 2 fallas consecutivas. `INCONCLUSIVE` queda para revision de evidencia, no para alertar fuerte.

La guia de piloto recurrente staging esta en `docs/operations/v0.4-staging-pilot.md`.

## Deploy staging

Para dejarlo corriendo fuera de una notebook:

```text
docs/operations/deploy-staging-vm.md
```

Incluye Docker Compose, Slack webhook por `.env` y volumen persistente para `runs/`.

Alternativa Vercel + Supabase:

```text
docs/operations/deploy-vercel-supabase.md
```

Variables Vercel y DNS Cloudflare:

```text
docs/operations/vercel-env-cloudflare.md
```

## Regla de producto

CommerceGuard no debe modelarse como "monitor de Shopify", "monitor de Magento" o "monitor de WooCommerce". La categoria correcta es:

> Monitoring black-box de journeys comerciales criticos para ecommerce, CMS, storefronts headless y desarrollos custom.

El core debe ser agnostico de plataforma. Las recetas pueden adaptarse a Shopify, WooCommerce, Magento, VTEX, Tiendanube, WordPress, headless o custom.
