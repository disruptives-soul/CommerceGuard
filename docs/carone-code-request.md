# Prompt para pedir codigo Car One

Actua como agente tecnico del proyecto Car One. Necesitamos preparar un discovery tecnico para CommerceGuard.

CommerceGuard es un runner black-box con Playwright que valida si un usuario real puede completar un journey comercial critico. No queremos convertirlo en un monitor de Magento, Next.js o Cloudflare; queremos validar el flujo comercial desde navegador.

Contexto conocido:

- Backend/backoffice: Magento.
- Frontend: Next.js headless.
- Edge/deployment: Cloudflare.
- Journey inicial: Comprar -> listado/stock -> ficha de vehiculo -> CTA de interes -> siguiente estado comercial -> STOP.

Necesitamos revisar primero el codigo Next.js porque es la capa que experimenta el usuario.

## Enviame o preparame

Un ZIP o acceso al repo del frontend Next.js, excluyendo:

```text
node_modules
.next
dist
build
.git
logs
coverage
```

No incluir secretos:

```text
.env
.env.local
API keys
Magento admin credentials
Cloudflare tokens
private keys
passwords
```

Si existen, si incluir:

```text
.env.example
.env.template
README
next.config.*
wrangler.toml
wrangler.jsonc
package.json
pnpm-lock.yaml / package-lock.json / yarn.lock
```

## Necesito ubicar

- estructura `app/` o `pages/`;
- ruta `/comprar`;
- ruta de detalle de vehiculo;
- componente de listado;
- componente de card de vehiculo;
- componente del CTA `Me interesa`;
- que ocurre despues del click;
- clientes GraphQL/REST;
- endpoints Magento consumidos;
- loading states;
- empty states;
- error states;
- variables de entorno;
- configuracion Cloudflare/deployment;
- reglas de cache o bot protection relevantes.

## Preguntas concretas

Respondeme:

1. Cual es la URL/ruta real del flujo Comprar.
2. Como se obtiene el listado de vehiculos.
3. Que endpoint/API alimenta el listado.
4. Como se define que un vehiculo esta disponible.
5. Como se construye la URL de detalle.
6. Que campos minimos deberian aparecer en ficha.
7. Cual es el CTA principal de intencion comercial.
8. Que ocurre despues de clickear `Me interesa`.
9. Ese click dispara algun lead o solo abre un paso/formulario.
10. Donde debe detenerse CommerceGuard para no crear efectos reales.
11. Existe staging seguro.
12. Cloudflare puede bloquear Playwright.
13. Hay forma de crear un vehiculo fixture para pruebas.
14. Hay feature flags o mocks para simular fallos.

## Fallos controlados deseados

Si podemos trabajar sobre staging o branch test, preparar modos:

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

El objetivo no es romper produccion. Es validar que CommerceGuard detecta y clasifica fallos conocidos.

## Resultado esperado

Con esa informacion vamos a construir:

- Journey Spec Car One.
- Playwright happy path.
- Failure Lab controlado.
- Reporte de estabilidad.
- Separacion entre CommerceGuard Core y adaptador Car One.

