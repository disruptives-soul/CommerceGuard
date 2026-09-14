# Deploy CommerceGuard Staging Pilot

Objetivo: dejar CommerceGuard corriendo fuera de una notebook durante 3-5 dias, sin SaaS/dashboard.

## Opcion recomendada

Usar una VM Linux pequena con Docker. Puede ser cualquier proveedor/cloud donde ya tengan cuenta. El proceso mantiene:

- scheduler cada 5 minutos;
- Slack webhook;
- no-submit;
- 2 fallas consecutivas antes de alertar;
- evidencia persistida en volumen Docker.

## 1. Preparar repo

Desde local:

```powershell
git status
git add .
git commit -m "Prepare CommerceGuard staging pilot deploy"
git push origin main
```

No commitear `.env`, `.env.local` ni la URL del webhook.

## 2. Preparar VM

En la VM:

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

Cerrar y abrir sesion si Docker pide permisos.

## 3. Clonar

```bash
git clone https://github.com/disruptives-soul/CommerceGuard.git
cd CommerceGuard
```

## 4. Configurar secreto Slack

Crear `.env` en la VM:

```bash
cat > .env <<'EOF'
CG_WEBHOOK_URL=https://hooks.slack.com/services/REEMPLAZAR/REEMPLAZAR/REEMPLAZAR
EOF
chmod 600 .env
```

## 5. Levantar scheduler

```bash
docker compose -f docker-compose.staging.yml --env-file .env up -d --build
```

Ver logs:

```bash
docker compose -f docker-compose.staging.yml logs -f
```

Estado:

```bash
docker compose -f docker-compose.staging.yml ps
```

## 6. Reportes

Ejecutar dentro del contenedor:

```bash
docker compose -f docker-compose.staging.yml exec commerceguard pnpm run report:daily -- --hours 24 --project car-one --env staging
docker compose -f docker-compose.staging.yml exec commerceguard pnpm run report:scheduler -- --hours 24 --project car-one --env staging
```

Copiar evidencia/reportes:

```bash
docker cp $(docker compose -f docker-compose.staging.yml ps -q commerceguard):/app/runs ./runs-export
```

## 7. Parar piloto

```bash
docker compose -f docker-compose.staging.yml down
```

Para borrar evidencia persistida:

```bash
docker compose -f docker-compose.staging.yml down -v
```

## Nota de seguridad

La URL de Slack webhook debe rotarse si fue pegada en chats o logs. Guardarla solo en `.env` de la VM o en secrets del proveedor.
