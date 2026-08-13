#!/usr/bin/env bash
# Arranca n8n para o piloto WhatsApp (Community, licença 0).
set -euo pipefail

cd "$(dirname "$0")/../.."

export EKANDA_API_URL="${EKANDA_API_URL:-https://ekanda-school-portal-api.onrender.com/api/v1}"
export N8N_WEBHOOK_SECRET="${N8N_WEBHOOK_SECRET:-ekanda-dev-webhook-secret}"

echo "EKANDA_API_URL=$EKANDA_API_URL"
docker compose up -d n8n

echo ""
echo "n8n: http://localhost:5678"
echo "Importar workflow: docs/n8n/ekanda-whatsapp-concierge.json"
echo "Túnel público: ./scripts/whatsapp-pilot/start-n8n-tunnel.sh"
