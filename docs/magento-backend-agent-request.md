# Pedido para agente backend Magento

Necesitamos preparar un entorno local/staging de Magento para validar CommerceGuard, un runner black-box que prueba journeys comerciales criticos con Playwright. No es una prueba unitaria ni API test: simula un usuario real en navegador.

## Objetivo

Habilitar un journey seguro:

1. Abrir producto.
2. Agregar al carrito.
3. Entrar al carrito.
4. Ir a checkout.
5. Verificar que el checkout carga.
6. Detenerse antes de confirmar orden, pago, reserva o lead real.

## Necesitamos que nos pases

- URL base accesible desde Windows host, no solo desde contenedor.
- URL de un producto simple, publicado, en stock y con precio.
- Si hay configurable/bundle, dejarlo para segunda fase; primero producto simple.
- Credenciales si el entorno tiene basic auth.
- Metodo de shipping sandbox visible en checkout.
- Metodo de pago sandbox/no real, por ejemplo Check/Money Order, Bank Transfer o payment fake.
- Confirmacion de que captcha, 2FA, WAF, rate limit o bot protection esten desactivados en local/staging.
- Confirmacion de que no se dispara email real, pago real, reserva real ni integracion productiva.

## Datos semilla pedidos

Crear o confirmar:

- Producto simple: `CommerceGuard Test Product`
- SKU: `CG-TEST-001`
- Stock: al menos 20 unidades
- Precio: cualquier precio valido
- Categoria visible
- Storefront funcionando en modo guest
- Checkout guest habilitado

## Selectores estables pedidos

Si pueden, agregar atributos `data-cg` en el tema o template local. Esto evita que CommerceGuard dependa de clases fragiles de Magento.

Minimo:

```html
data-cg="add-to-cart"
data-cg="cart-success"
data-cg="proceed-to-checkout"
data-cg="checkout-email"
```

Para segunda fase:

```html
data-cg="checkout-firstname"
data-cg="checkout-lastname"
data-cg="checkout-street"
data-cg="checkout-city"
data-cg="checkout-postcode"
data-cg="checkout-telephone"
data-cg="checkout-shipping-method"
data-cg="checkout-payment-method"
data-cg="place-order"
```

CommerceGuard no va a clickear `place-order` en la primera validacion. Solo necesitamos identificarlo para saber donde cortar.

## Variables que usaremos

En CommerceGuard vamos a correr:

```powershell
$env:MAGENTO_BASE_URL="http://magento.local"
$env:MAGENTO_PRODUCT_URL="http://magento.local/commerceguard-test-product.html"
pnpm run run -- recipes/magento-local.template.json
```

Reemplazar las URLs por las reales del entorno local.

## Criterio de aceptacion

El entorno esta listo cuando:

- La URL base abre desde el navegador de Windows.
- La URL del producto abre sin login administrativo.
- El producto se puede agregar al carrito.
- El carrito muestra el producto agregado.
- El boton de checkout aparece.
- El checkout carga al menos hasta el campo email.
- La prueba puede repetirse 20 veces sin depender de datos manuales.

## Importante

No necesitamos acceso al admin de Magento para la primera prueba si el storefront y el producto estan listos. Si se requiere login de storefront, pasar usuario de prueba y avisar para crear una receta autenticada.
