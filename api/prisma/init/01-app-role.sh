#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anima_app') THEN
    CREATE ROLE anima_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
  END IF;
END
\$\$;
EOSQL
