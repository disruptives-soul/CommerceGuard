import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4173);
const mode = process.env.CG_MOCK_MODE ?? "NORMAL";

function listingHtml(): string {
  const content = mode === "EMPTY_RESULT"
    ? `<p>No hay resultados para esta busqueda</p>`
    : `<article>
          <a href="/comprar/usados/cg-test-vehicle" data-cg="vehicle-detail-link" data-cg-stock-status="IN_STOCK" data-cg-available="true" data-cg-condition="usados" data-cg-url-key="cg-test-vehicle">
            <h2 data-cg="vehicle-title">CommerceGuard Test Vehicle</h2>
            <p>Version Local Mock</p>
            <p data-cg="vehicle-price">$ 123.456</p>
          </a>
        </article>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Car One Mock - Comprar</title>
  </head>
  <body>
    <header>
      <a href="/comprar">Comprar</a>
    </header>
    <main>
      <h1>Comprar</h1>
      <section aria-label="Listado de vehiculos">
        ${content}
      </section>
    </main>
  </body>
</html>`;
}

function detailHtml(): string {
  const cta = mode === "BROKEN_CTA"
    ? `<p>CTA temporalmente no disponible</p>`
    : `<button type="button" id="interest" data-cg="interest-cta">Me interesa este vehiculo</button>`;
  const price = mode === "BROKEN_PRICE"
    ? `<p>Precio no disponible</p>`
    : `<p>$ 123.456</p>`;

  const script = mode === "BROKEN_CTA"
    ? ""
    : `<script>
      ${mode === "JS_EXCEPTION" ? "throw new Error('CommerceGuard mock JS exception');" : ""}
      document.getElementById("interest").addEventListener("click", () => {
        document.getElementById("interest-modal").hidden = false;
      });
      document.getElementById("continue-interest").addEventListener("click", () => {
        document.getElementById("interest-modal").hidden = true;
        document.getElementById("success-modal").hidden = false;
      });
    </script>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Car One Mock - Ficha</title>
  </head>
  <body>
    <main>
      <nav><a href="/comprar">Comprar</a></nav>
      <article>
        <h1>CommerceGuard Test Vehicle</h1>
        <p>Version Local Mock</p>
        <p>Año 2026 · Automatico · 0 km</p>
        <div data-cg="vehicle-price">${price}</div>
        ${cta}
      </article>
      <section id="interest-modal" role="dialog" aria-modal="true" data-cg="lead-form" hidden>
        <h2>Completa tus datos</h2>
        <label>
          Nombre
          <input id="name" name="name" autocomplete="off">
        </label>
        <label>
          Telefono de contacto
          <input id="phone" name="phone" autocomplete="off">
        </label>
        <button type="button" id="continue-interest" data-cg="stop-before-submit">Continuar</button>
      </section>
      <section id="success-modal" role="dialog" aria-modal="true" hidden>
        <h2>Gracias por completar tus datos</h2>
        <p>Ahora, podes seguir configurando tu auto.</p>
        <button type="button">Seguir configurando</button>
      </section>
    </main>
    ${script}
  </body>
</html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (mode === "API_TIMEOUT") {
    setTimeout(() => {
      response.writeHead(504, { "content-type": "text/plain; charset=utf-8" });
      response.end("API timeout");
    }, 35_000);
    return;
  }

  if (mode === "API_500" && url.pathname === "/comprar") {
    response.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    response.end("<h1>Algo salio mal</h1><p>API 500</p>");
    return;
  }

  const respond = () => {
  if (url.pathname === "/" || url.pathname === "/comprar") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(listingHtml());
    return;
  }

  if (url.pathname === "/comprar/usados/cg-test-vehicle") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(detailHtml());
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
  };

  if (mode === "SLOW_RESPONSE") {
    setTimeout(respond, 2_500);
    return;
  }

  respond();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Car One local mock listening on http://127.0.0.1:${port} (${mode})`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
