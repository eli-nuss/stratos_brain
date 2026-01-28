#!/bin/bash
# Read-only Supabase query wrapper for sub-agents
# Uses direct PostgreSQL connection (read-only user)

set -e

# Read-only database connection
# User: readonly_user (SELECT only, no INSERT/UPDATE/DELETE)
export DATABASE_URL="postgresql://readonly_user:generate_a_secure_password_here@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require"

# Use psql for direct queries
# Usage: ./supabase-readonly.sh "SELECT * FROM assets LIMIT 10"

if [ $# -eq 0 ]; then
    echo "Usage: $0 'SELECT ...'"
    exit 1
fi

psql "$DATABASE_URL" -c "$@"
