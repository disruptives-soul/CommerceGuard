# CommerceGuard Technical Discovery Plan

CommerceGuard debe validar journeys comerciales criticos desde afuera, como usuario real. El acceso al codigo de Car One puede acelerar el discovery, pero no debe convertirse en requisito permanente del producto.

Regla central:

> Usamos acceso al codigo para entender, reproducir y provocar fallos controlados. Pero CommerceGuard debe seguir siendo capaz de detectar el problema desde afuera.

## Dos tracks

```text
Car One
  |
  +-- Black-box CommerceGuard
  |     navegador real
  |     journey publico
  |     resultado observable
  |
  +-- White-box discovery
        Next.js
        Magento
        Cloudflare/deployment
        fallos controlados
```

El black-box es el producto. El white-box es herramienta de desarrollo, validacion y failure lab.

## Track A: black-box

Objetivo:

```text
CommerceGuard
  -> URL publica o staging
  -> navegador real
  -> Home
  -> Comprar
  -> listado/stock
  -> vehiculo disponible
  -> ficha
  -> CTA de intencion comercial
  -> siguiente estado observable
  -> STOP
```

No debe:

- consultar Magento directamente para decidir PASS;
- usar APIs privadas como condicion principal;
- crear lead;
- crear orden;
- disparar pago;
- depender de conocer el codigo interno.

## Track B: white-box

Objetivo:

- entender como funciona el journey real;
- ubicar endpoints y dependencias;
- detectar selectors mas estables;
- entender loading/error/empty states;
- crear fallos controlados;
- construir un banco de pruebas para clasificacion.

El acceso interno no debe esconder problemas. Si CommerceGuard solo funciona porque conoce detalles privados del sistema, todavia no valida la tesis platform-agnostic.

## Revisar primero: Next.js

Buscar:

- estructura `app/` o `pages/`;
- ruta `/comprar`;
- ruta de detalle de vehiculo;
- componente de listado;
- componente de card;
- componente de CTA comercial;
- outcome despues de click en `Me interesa`;
- clientes GraphQL/REST;
- manejo de errores;
- loading states;
- empty states;
- filtros;
- variables de entorno;
- analytics;
- configuracion Cloudflare/deployment.

Mapa esperado:

```text
/comprar
  -> VehicleListing
  -> fetch/client
  -> Magento/API
  -> VehicleCard
  -> /comprar/[vehicle]
  -> VehicleDetail
  -> InterestCTA
  -> next commercial state
```

## Revisar despues: Magento

No para convertir CommerceGuard en Magento monitor. Solo para entender dependencias detras del journey.

Buscar:

- catalogo/vehiculos;
- stock/disponibilidad;
- atributos;
- precios;
- sucursales;
- GraphQL/REST;
- custom modules;
- lead/reserva;
- integraciones.

Preguntas:

- que endpoints alimentan listado;
- que endpoints alimentan ficha;
- que endpoint ocurre despues del CTA;
- que efectos laterales existen;
- que datos son seguros para staging.

## Revisar Cloudflare/deployment

Cloudflare es parte del sistema bajo prueba, no una dependencia del producto.

Buscar:

- Cloudflare Pages, Workers u otro runtime;
- `wrangler.toml` / `wrangler.jsonc`;
- `next.config.*`;
- OpenNext/adapters;
- bindings;
- environment variables;
- routes;
- cache rules;
- bot protection/challenges.

CommerceGuard debe distinguir:

- fallo comercial real;
- bloqueo/challenge del monitor;
- resultado inconcluso.

## Failure Lab

Crear una branch/staging controlada, por ejemplo:

```text
commerceguard-test
```

Modos de fallo candidatos:

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

Ejemplos:

```text
BROKEN_CTA
  esperado: COMMERCE_FAILURE
  step: INTEREST_CTA
  reason: CTA_NOT_VISIBLE

API_500
  esperado: COMMERCE_FAILURE o INCONCLUSIVE segun evidencia
  step: BUY_LISTING

JS_EXCEPTION
  esperado: COMMERCE_FAILURE si la UI queda inutilizable
```

## Dos tipos de pruebas

### Deterministic test

Usa fixture estable en staging:

```text
CG TEST VEHICLE
```

Sirve para validar el runner y la clasificacion.

### Real business test

Usa inventario dinamico:

```text
Comprar -> elegir vehiculo disponible -> ficha -> CTA
```

Sirve para validar el comportamiento real del catalogo.

## Orden de trabajo

1. Revisar repo Next.js.
2. Mapear journey real en codigo.
3. Revisar endpoints Magento usados por ese journey.
4. Revisar Cloudflare/deployment.
5. Ejecutar journey manual en produccion o staging.
6. Crear Playwright happy path.
7. Crear staging/fixture controlado.
8. Inyectar 4 a 6 fallos conocidos.
9. Validar clasificacion CommerceGuard.
10. Ejecutar repetidamente.
11. Separar core de implementacion Car One.
12. Probar contra segundo ecommerce.

## Gate CTO

### Viable

Si CommerceGuard valida:

- journey real;
- repeticion;
- assertions robustas;
- deteccion de fallo conocido;
- evidencia util;
- flakiness aceptable;
- separacion razonable entre core y Car One.

### Iterar

Si aparecen:

- selectors fragiles;
- alta flakiness;
- bloqueos frecuentes;
- clasificacion ambigua;
- evidence insuficiente.

### Cuestionar tesis

Si para Car One necesitamos:

- integracion Magento profunda;
- APIs privadas;
- mucho codigo especifico;
- conocimiento interno exhaustivo;
- mantenimiento manual frecuente.

