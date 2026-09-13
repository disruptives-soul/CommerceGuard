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

## Resultado

Cada corrida escribe evidencia en:

```text
runs/<journey-id>/<timestamp>/
```

Archivos principales:

- `result.json`: resumen estructurado.
- `screenshots/*.png`: capturas por step.

## Clasificaciones

- `PASS`: el journey completo paso.
- `JOURNEY_FAILURE`: el sitio cargo, pero el flujo no cumplio una asercion.
- `TIMEOUT`: se agoto el tiempo de espera.
- `AUTOMATION_BLOCKED`: el sitio bloqueo la automatizacion.
- `NETWORK_FAILURE`: fallo de red relevante.
- `UNEXPECTED_STATE`: estado no previsto.
- `EXTERNAL_SERVICE_FAILURE`: dependencia externa caida o inestable.

## Regla de producto

CommerceGuard no debe modelarse como "monitor de Shopify", "monitor de Magento" o "monitor de WooCommerce". La categoria correcta es:

> Monitoring black-box de journeys comerciales criticos para ecommerce, CMS, storefronts headless y desarrollos custom.

El core debe ser agnostico de plataforma. Las recetas pueden adaptarse a Shopify, WooCommerce, Magento, VTEX, Tiendanube, WordPress, headless o custom.
