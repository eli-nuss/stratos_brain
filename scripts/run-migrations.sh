#!/bin/bash
# Run SQL migrations against Supabase database

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required variables
if [ -z "$SUPABASE_DB_HOST" ] || [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo "Error: SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD must be set"
    exit 1
fi

MIGRATIONS_DIR="supabase/migrations"

echo "Running migrations against ${SUPABASE_DB_HOST}..."

for migration in $(ls ${MIGRATIONS_DIR}/*.sql | sort); do
    echo "Applying: ${migration}"
    PGPASSWORD=${SUPABASE_DB_PASSWORD} psql \
        -h ${SUPABASE_DB_HOST} \
        -p ${SUPABASE_DB_PORT:-5432} \
        -U ${SUPABASE_DB_USER:-postgres} \
        -d ${SUPABASE_DB_NAME:-postgres} \
        -f ${migration}
done

echo "Migrations complete!"
