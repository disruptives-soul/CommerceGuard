# Car One CommerceGuard v0.1

Este documento resume las decisiones accionables a partir del discovery del frontend `marketplace-frontend`.

## Ruta objetivo

```text
${CARONE_BASE_URL}/comprar
```

Valores esperados:

- Produccion: `https://carone.com.ar`
- Staging: `https://stg.carone.com.ar`

El frontend usa Next.js App Router. La ficha de vehiculo usa:

```text
/comprar/{condition}/{url_key}
```

Donde `condition` puede ser:

```text
usados
pda
0km
```

## Journey v0.1

```text
/comprar
  -> primer link visible /comprar/{condition}/{slug}
  -> ficha de vehiculo
  -> CTA "Me interesa este vehiculo" o "Me interesa"
  -> modal anonimo con "Telefono de contacto"
  -> STOP antes de escribir o enviar datos
```

La receta base esta en:

```text
recipes/car-one.template.json
```

## Prueba local

Levantar mock local:

```powershell
pnpm.cmd run mock:car-one
```

En otra terminal, ejecutar la receta contra el mock:

```powershell
$env:CARONE_BASE_URL="http://127.0.0.1:4173"
pnpm.cmd run run -- recipes/car-one.template.json
```

Modos de fallo locales:

```powershell
$env:CG_MOCK_MODE="BROKEN_CTA"
pnpm.cmd run mock:car-one
```

```powershell
$env:CG_MOCK_MODE="EMPTY_RESULT"
pnpm.cmd run mock:car-one
```

Ejecucion sugerida:

```powershell
$env:CARONE_BASE_URL="https://stg.carone.com.ar"
pnpm.cmd run run -- recipes/car-one.template.json
```

## STOP seguro

En produccion anonima, CommerceGuard puede clickear el CTA porque el click no crea lead directo. El STOP seguro es el modal `InterestedModal` visible con:

```text
Telefono de contacto
Continuar
```

No hacer en produccion:

- No llenar nombre.
- No llenar telefono.
- No clickear `Continuar`.
- No avanzar a reserva.
- No abrir flujos de pago.
- No usar una sesion/cookie con datos reales.

Si existe sesion o cookie `carone_customer_data`, el CTA puede navegar a:

```text
/comprar/configura/{slug}
```

Ese caso debe ser una receta separada de staging/controlada.

## Submit controlado

La receta segura de v0.1 se detiene antes de enviar datos:

```text
recipes/car-one.template.json
```

Para pruebas locales o staging aislado existe una receta separada que completa el modal con datos fake y se detiene en el success modal:

```text
recipes/car-one.submit-controlled.template.json
```

Esta receta esta bloqueada por guardrails:

- Solo acepta `http://localhost:*`, `http://127.0.0.1:*` o `https://stg.carone.com.ar`.
- Requiere `CG_ALLOW_SUBMIT="true"`.
- Requiere que la receta tenga `safeSubmit: true`.
- Requiere nombre y telefono fake por env.

Ejecucion local contra el frontend Car One:

```powershell
$env:CARONE_BASE_URL="http://localhost:3000"
$env:CG_ALLOW_SUBMIT="true"
$env:CG_TEST_LEAD_NAME="CommerceGuard Test"
$env:CG_TEST_LEAD_PHONE="1169625487"
pnpm.cmd run run -- recipes/car-one.submit-controlled.template.json
```

Ejecucion staging solo si CRM/reserva/pago estan aislados o desactivados:

```powershell
$env:CARONE_BASE_URL="https://stg.carone.com.ar"
$env:CG_ALLOW_SUBMIT="true"
$env:CG_TEST_LEAD_NAME="CommerceGuard Test"
$env:CG_TEST_LEAD_PHONE="1169625487"
pnpm.cmd run run -- recipes/car-one.submit-controlled.template.json
```

No correr esta receta contra produccion. El loader la bloquea por `allowedBaseUrlPrefixes`, pero igualmente debe tratarse como una prueba con efecto comercial controlado.

## Selectors actuales

Como el frontend todavia no tiene `data-cg`, la receta usa selectors observables:

```text
a[href^="/comprar/usados/"]
a[href^="/comprar/0km/"]
a[href^="/comprar/pda/"]
button:has-text("Me interesa")
text "Telefono de contacto"
text "Continuar"
```

Estos selectors son aceptables para v0.1, pero fragiles a cambios de copy/layout.

## Selectors recomendados para hardening

Pedir al equipo frontend agregar:

```html
data-cg="buy-entry"
data-cg="vehicle-list"
data-cg="vehicle-list-error"
data-cg="vehicle-list-empty"
data-cg="vehicle-card"
data-cg="vehicle-detail-link"
data-cg="vehicle-title"
data-cg="vehicle-price"
data-cg="vehicle-detail"
data-cg="vehicle-detail-gallery"
data-cg="interest-cta"
data-cg="interest-next-step"
data-cg="lead-form"
data-cg="stop-before-submit"
```

Opcionales utiles:

```html
data-cg-sku="..."
data-cg-url-key="..."
data-cg-condition="usados|0km|pda"
data-cg-stock-status="IN_STOCK"
data-cg-available="true"
```

## Requests y errores criticos

Criticos para el journey:

- POST `/api/graphql` de listado.
- POST `/api/graphql` de detalle.
- Cloudflare 403, 429, 503 o challenge.
- `pageerror` o hydration error que inutilice listado, ficha o CTA.
- Loading infinito en listado/ficha/CTA.

No critico por si solo:

- `/api/salesforce/track` puede devolver 400 en receta anonima sin submit. No debe fallar el journey si la UI permite avanzar hasta el STOP.
- `/api/magento/track-view` sirve como evidencia secundaria, pero no debe bloquear PASS si la experiencia comercial funciona.

## Pendientes para robustecer

- Confirmar si staging puede correr sin WAF/challenge para Playwright.
- Crear fixture `CG TEST VEHICLE` con `stock_status=IN_STOCK`, `url_key` estable y tags que permitan condition.
- Agregar `data-cg`.
- Agregar failure lab solo staging, por ejemplo `NEXT_PUBLIC_CG_FAILURE_MODE`.
- Separar receta anonima de receta con cookie/sesion.
