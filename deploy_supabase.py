import os
import json
import subprocess

def call_mcp_tool(server, tool, input_data):
    cmd = [
        "manus-mcp-cli", "tool", "call", tool,
        "--server", server,
        "--input", json.dumps(input_data)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error calling {tool}: {result.stderr}")
        return None
    return result.stdout

project_id = "wfogbaipiqootjrsprde"

# 1. Deploy Edge Function
print("Deploying Edge Function...")
with open("/home/ubuntu/stratos_brain/supabase/functions/control-api/index.ts", "r") as f:
    index_content = f.read()

deploy_input = {
    "project_id": project_id,
    "name": "control-api",
    "files": [{"name": "index.ts", "content": index_content}]
}
call_mcp_tool("supabase", "deploy_edge_function", deploy_input)

# 2. Apply Migration
print("Applying Migration...")
with open("/home/ubuntu/stratos_brain/supabase/migrations/0002_ai_scoring_v2_schema.sql", "r") as f:
    migration_query = f.read()

migration_input = {
    "project_id": project_id,
    "name": "update_v_dashboard_all_assets_v2",
    "query": migration_query
}
call_mcp_tool("supabase", "apply_migration", migration_input)

print("Deployment complete!")
