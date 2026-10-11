#!/usr/bin/env bash
# Copia de seguridad diaria de PostgreSQL con pg_dump; conserva 7 días.
# Cron en el servidor (como el usuario que ejecuta docker):
#   0 2 * * * /opt/reservaya/scripts/backup-db.sh >> /var/log/reservaya-backup.log 2>&1
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/reservaya}"
BACKUP_DIR="${BACKUP_DIR:-/opt/reservaya-backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

cd "$PROJECT_DIR"
# shellcheck disable=SC1091
set -a && . ./.env && set +a

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/reservaya-$(date +%F-%H%M).sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-reservaya}" "${POSTGRES_DB:-reservaya}" | gzip > "$FILE"

find "$BACKUP_DIR" -name 'reservaya-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "$(date -Is) backup creado: $FILE ($(du -h "$FILE" | cut -f1))"
