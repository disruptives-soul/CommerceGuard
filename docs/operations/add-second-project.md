# Agregar Segundo Journey o Proyecto

Objetivo: sumar cobertura sin convertir CommerceGuard en SaaS ni reescribir core.

## 1. Crear receta

Copiar una receta existente y cambiar metadata:

```json
{
  "id": "project-slug-critical-journey-v0",
  "name": "Project critical journey v0",
  "projectId": "project-slug",
  "adapter": "project-slug",
  "reportGroup": "real"
}
```

Reglas:

- `projectId`: identifica comercio/proyecto.
- `adapter`: identifica convenciones/selectores propios.
- `reportGroup`: usar `real` para monitoreo real y `failure-lab` para laboratorio.

## 2. Mantener el core intacto

No tocar `src/runner` salvo que falte una primitiva reusable. Primero intentar resolver con:

- selectores robustos;
- `assertText`;
- `assertUrl`;
- `selectorVisible`;
- `clickFirst`;
- `stopBeforeIrreversibleAction`.

## 3. Crear config scheduler

Crear `configs/scheduler.<project>.<env>.json`:

```json
{
  "projectId": "project-slug",
  "environment": "staging",
  "intervalMs": 300000,
  "jobs": [
    {
      "id": "critical-journey-staging",
      "recipe": "recipes/project.critical-journey.json"
    }
  ],
  "alertPolicy": {
    "notifyOn": ["COMMERCE_FAILURE", "MONITOR_FAILURE"],
    "minConsecutiveFailures": 2,
    "notifyOnRecovery": true
  },
  "notifications": {
    "mode": "stdout"
  }
}
```

## 4. Validar estabilidad

```powershell
$env:PROJECT_BASE_URL="https://staging.example.com"
pnpm.cmd run run:repeat -- recipes/project.critical-journey.json --count 50
pnpm.cmd run scheduler -- configs/scheduler.project.staging.json --cycles 3
pnpm.cmd run report:real -- 50
```

## 5. Criterio de entrada al piloto

- 50 corridas con 0 `COMMERCE_FAILURE`.
- 0 `MONITOR_FAILURE` no explicado.
- `INCONCLUSIVE` revisados y documentados.
- alertas probadas con 2 fallas consecutivas.
- evidencia suficiente: screenshots, failedStep, reason, URL y runDir.
