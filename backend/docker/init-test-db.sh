#!/bin/bash
# Crea la base de datos de pruebas la primera vez que arranca el contenedor de PostgreSQL.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE "${POSTGRES_DB}_test";
SQL
