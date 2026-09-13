# Prompt senior para discovery del frontend Car One

Actua como agente tecnico senior del proyecto Car One, con foco Full Stack / Next.js / headless commerce.

Necesitamos preparar un discovery tecnico para CommerceGuard.

CommerceGuard es un runner black-box con Playwright que valida si un usuario real puede completar un journey comercial critico desde navegador. No queremos convertirlo en un monitor de Magento, Next.js o Cloudflare. Queremos validar el flujo comercial observable.

## Contexto conocido

- Backoffice / commerce engine: Magento.
- Frontend: Next.js headless.
- Edge / serving / seguridad: Cloudflare.
- Journey inicial: Comprar -> listado/stock -> ficha de vehiculo -> CTA de interes -> siguiente estado comercial -> STOP.

La primera capa a revisar es el frontend Next.js, porque es lo que experimenta el usuario y lo que CommerceGuard va a automatizar con Playwright.

## Principio de trabajo

Usamos acceso al codigo para entender el sistema, encontrar mejores puntos de observacion y crear fallos controlados. Pero CommerceGuard debe seguir funcionando como black-box:

```text
CommerceGuard
  -> navegador real
  -> URL publica/staging
  -> DOM + network observable
  -> outcome comercial
```

No usar el conocimiento interno como requisito permanente del producto.

## Enviame o preparame

Un ZIP o acceso al repo del frontend Next.js.

Excluir:

```text
node_modules
.next
dist
build
.git
logs
coverage
playwright-report
test-results
```

No incluir secretos:

```text
.env
.env.local
.env.production
API keys
Magento admin credentials
Cloudflare tokens
private keys
passwords
webhook secrets
JWT secrets
basic auth passwords
```

Si existen, incluir versiones sin secretos:

```text
.env.example
.env.template
README
next.config.*
wrangler.toml
wrangler.jsonc
open-next config
package.json
pnpm-lock.yaml / package-lock.json / yarn.lock
tsconfig.json
middleware.*
instrumentation.*
```

## Relevamiento tecnico requerido

Necesito que revises y reportes:

### 1. Framework y routing

- version de Next.js;
- si usa `app/` router o `pages/` router;
- si las rutas son SSR, SSG, ISR o client-side;
- ruta real del flujo Comprar;
- ruta real de detalle de vehiculo;
- middlewares relevantes;
- redirects / rewrites / dynamic routes.

### 2. Journey Comprar

Mapear paso por paso:

```text
Home
  -> Comprar
  -> listado/stock
  -> card de vehiculo
  -> ficha
  -> CTA "Me interesa" o equivalente
  -> siguiente estado comercial
  -> STOP
```

Para cada paso, reportar:

- componente principal;
- archivo/ruta del componente;
- accion del usuario;
- outcome esperado;
- selector/rol/texto estable;
- estado de carga;
- estado vacio;
- estado de error;
- si hay side effects.

### 3. Data fetching

Identificar:

- donde se obtiene el listado;
- donde se obtiene el detalle;
- cliente GraphQL/REST usado;
- endpoint Magento o middleware interno;
- server actions/API routes si existen;
- fetch desde server component vs client component;
- cache de Next (`force-cache`, `no-store`, `revalidate`);
- SWR/React Query/Apollo/u otro cliente;
- shape minimo de respuesta necesario para el journey.

### 4. Disponibilidad de vehiculo

Explicar como se define que un vehiculo es elegible:

- stock;
- estado publicado;
- precio;
- sucursal;
- tipo 0 km/usado;
- vendido/reservado;
- filtros del listado;
- condiciones para mostrar CTA.

### 5. Ficha de vehiculo

Campos minimos que CommerceGuard deberia verificar:

- titulo/modelo;
- precio o leyenda comercial equivalente;
- imagen/media principal;
- informacion comercial clave;
- CTA principal;
- estado disponible/no disponible;
- mensajes de error o fallback.

No pedir assertions excesivas. La pregunta principal es:

> Existe una ficha comercial suficientemente funcional para que el usuario pueda avanzar?

### 6. CTA de intencion comercial

Identificar exactamente:

- componente del CTA;
- texto real;
- condicion de render;
- condicion de disabled/loading;
- que pasa despues del click;
- si abre modal/drawer/formulario/nueva URL/WhatsApp;
- si dispara request;
- si crea lead o solo inicia un paso;
- punto exacto donde CommerceGuard debe detenerse.

Importante:

CommerceGuard no debe enviar formularios, crear leads, reservar, pagar ni crear orden real.

### 7. Error handling y estados ambiguos

Reportar como se ve cada caso:

- Magento/API devuelve 500;
- API timeout;
- respuesta vacia;
- vehiculo no disponible;
- precio ausente;
- JS exception/hydration error;
- Cloudflare challenge;
- network offline/intermitente;
- loading infinito;
- listado sin resultados legitimo.

Necesitamos distinguir:

```text
COMMERCE_FAILURE
MONITOR_FAILURE
INCONCLUSIVE
```

### 8. Selectores para Playwright

Proponer strategy de selectors.

Preferir:

- roles accesibles;
- labels;
- textos comerciales estables;
- URLs/rutas;
- atributos `data-cg` solo en staging o si son aceptables como contrato estable.

Evitar:

- clases CSS generadas;
- estructura DOM muy profunda;
- indexes fragiles;
- textos temporales de marketing.

Si se pueden agregar atributos estables, sugeridos:

```html
data-cg="buy-entry"
data-cg="vehicle-list"
data-cg="vehicle-card"
data-cg="vehicle-title"
data-cg="vehicle-price"
data-cg="vehicle-detail"
data-cg="interest-cta"
data-cg="interest-next-step"
data-cg="lead-form"
data-cg="stop-before-submit"
```

### 9. Cloudflare / deployment

Reportar:

- si corre en Cloudflare Pages, Workers, OpenNext u otro setup;
- si existe `wrangler.toml` / `wrangler.jsonc`;
- variables por entorno;
- cache rules relevantes;
- bot protection/challenge;
- WAF/rate limit;
- forma de tener staging sin bloquear Playwright;
- headers/cookies necesarios;
- si hay Cloudflare Access o basic auth.

### 10. Failure Lab

Si podemos trabajar sobre staging/branch test, proponer como simular:

```text
NORMAL
BROKEN_CTA
BROKEN_LISTING
BROKEN_PRICE
API_TIMEOUT
API_500
EMPTY_RESULT
JS_EXCEPTION
SLOW_RESPONSE
```

Puede ser mediante:

- feature flags;
- mocks;
- fixture data;
- endpoint local/staging;
- interception en Playwright;
- variables de entorno no productivas.

No romper produccion.

## Preguntas concretas a responder

1. Cual es la URL/ruta real del flujo Comprar.
2. Usa `app/` router o `pages/` router.
3. Como se obtiene el listado de vehiculos.
4. Que endpoint/API alimenta el listado.
5. Como se define vehiculo disponible/elegible.
6. Como se construye la URL de detalle.
7. Que campos minimos deben aparecer en ficha.
8. Cual es el CTA principal de intencion comercial.
9. Que ocurre despues de clickear el CTA.
10. Ese click crea lead o solo abre un paso/formulario.
11. Donde debe detenerse CommerceGuard.
12. Que selectors estables recomendas.
13. Existe staging seguro.
14. Cloudflare puede bloquear Playwright.
15. Hay forma de crear un vehiculo fixture.
16. Hay feature flags/mocks para simular fallos.
17. Que requests o errores de consola deberian considerarse criticos.
18. Que datos no deberia capturar CommerceGuard por sensibilidad.

## Entregable esperado

Devolver un reporte con esta estructura:

```text
1. Resumen tecnico del frontend
2. Mapa de rutas Next.js
3. Journey Comprar paso a paso
4. Componentes involucrados
5. Data fetching y endpoints
6. Reglas de disponibilidad
7. CTA y side effects
8. Selector strategy para Playwright
9. Riesgos de Cloudflare/deployment
10. Failure Lab propuesto
11. Punto de STOP seguro
12. Recomendacion para CommerceGuard v0.1
```

Con esa informacion vamos a construir:

- Journey Spec Car One.
- Playwright happy path.
- Failure Lab controlado.
- Reporte de estabilidad.
- Separacion entre CommerceGuard Core y adaptador Car One.

