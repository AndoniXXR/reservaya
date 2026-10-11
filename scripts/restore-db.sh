#!/usr/bin/env bash
# Restaura una copia creada por backup-db.sh:  ./scripts/restore-db.sh /opt/reservaya-backups/reservaya-2026-11-03-0200.sql.gz
set -euo pipefail

FILE="${1:?Indica el archivo .sql.gz a restaurar}"
PROJECT_DIR="${PROJECT_DIR:-/opt/reservaya}"

cd "$PROJECT_DIR"
# shellcheck disable=SC1091
set -a && . ./.env && set +a

echo "Deteniendo el backend..."
docker compose -f docker-compose.prod.yml stop backend

echo "Restaurando $FILE en ${POSTGRES_DB:-reservaya}..."
gunzip -c "$FILE" | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "${POSTGRES_USER:-reservaya}" -d "${POSTGRES_DB:-reservaya}" --single-transaction --quiet

docker compose -f docker-compose.prod.yml start backend
echo "Listo."
