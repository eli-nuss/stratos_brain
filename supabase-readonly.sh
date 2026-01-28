#!/bin/bash
# Read-only Supabase query wrapper for sub-agents
# This script provides LIMITED read-only access to the database
# For use by sub-agents and automated tools only

set -e

# Read-only connection (no write permissions)
export SUPABASE_URL="https://wfogbaipiqootjrsprde.supabase.co"
export SUPABASE_SERVICE_KEY="sb_secret_READONLY_KEY_PLACEHOLDER"

# Use the main supabase.sh wrapper with read-only credentials
exec /home/eli/clawd/supabase.sh "$@"
