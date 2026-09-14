# Car One Adapter

Este adapter contiene convenciones especificas de Car One sin contaminar el core runner.

## Responsabilidades

- Recetas Car One: `recipes/car-one*.json`.
- Selectores estables esperados en frontend: `data-cg="vehicle-detail-link"`, `data-cg="interest-cta"`, `data-cg="lead-form"`.
- Failure Lab local: `src/dev/carOneMockServer.ts` y `src/dev/runCarOneFailureLab.ts`.
- Config scheduler: `configs/scheduler.car-one.*.json`.

## Contrato con Core

El core solo entiende:

- `JourneyConfig`
- steps genericos
- `productStatus`
- evidencia
- scheduler jobs

El adapter aporta metadata:

```json
{
  "projectId": "car-one",
  "adapter": "car-one",
  "reportGroup": "real"
}
```

Para sumar otro comercio o journey, crear una receta nueva con su `projectId`, `adapter` y `reportGroup`; evitar tocar `src/runner` salvo que falte una primitiva generica.
