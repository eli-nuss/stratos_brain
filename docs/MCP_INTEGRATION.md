# MCP Integration Guide for Stratos Brain

## Overview

Stratos Brain now supports the **Model Context Protocol (MCP)**, enabling standardized tool connectivity and plug-and-play integration with external data providers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Ecosystem                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  External MCP   │     │  External MCP   │                   │
│  │  Server         │     │  Server         │                   │
│  │  (Bloomberg)    │     │  (SEC Edgar)    │                   │
│  └────────┬────────┘     └────────┬────────┘                   │
│           │                       │                             │
│           └───────────┬───────────┘                             │
│                       │                                         │
│                       ▼                                         │
│           ┌───────────────────────┐                            │
│           │    MCP Client         │                            │
│           │    (chat-worker)      │                            │
│           └───────────┬───────────┘                            │
│                       │                                         │
│                       ▼                                         │
│           ┌───────────────────────┐                            │
│           │  Stratos MCP Server   │◄──── External Clients      │
│           │  (mcp-server)         │      (Claude, Cursor, etc) │
│           └───────────┬───────────┘                            │
│                       │                                         │
│                       ▼                                         │
│           ┌───────────────────────┐                            │
│           │  Unified Tool Library │                            │
│           │  (24 tools)           │                            │
│           └───────────────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## MCP Server Endpoint

### Base URL
```
https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server
```

### Health Check
```bash
curl https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server/health
```

Response:
```json
{
  "status": "healthy",
  "server": "stratos-brain-mcp",
  "version": "1.0.0",
  "protocol": "2024-11-05",
  "tools": 24
}
```

## JSON-RPC API

All MCP requests use JSON-RPC 2.0 format.

### Initialize Connection

```bash
curl -X POST https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "clientInfo": {
        "name": "my-client",
        "version": "1.0.0"
      }
    }
  }'
```

### List Available Tools

```bash
curl -X POST https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list"
  }'
```

### Call a Tool

```bash
curl -X POST https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tools/call",
    "params": {
      "name": "get_market_pulse",
      "arguments": {
        "data_type": "overview"
      }
    }
  }'
```

## Available Tools

| Tool Name | Description | Category |
|-----------|-------------|----------|
| `screen_assets` | Scan database for stocks/crypto matching criteria | Market-Wide |
| `get_market_pulse` | Today's market action (gainers, losers, sectors) | Market-Wide |
| `get_financial_calendar` | Earnings dates and economic events | Market-Wide |
| `search_assets` | Search for assets by symbol or name | Lookup |
| `get_asset_fundamentals` | Financial fundamentals for a company | Fundamentals |
| `get_price_history` | Historical OHLCV price data | Data |
| `get_technical_indicators` | RSI, MACD, moving averages, etc. | Technical |
| `get_active_signals` | Active trading signals | Signals |
| `get_ai_reviews` | AI-generated analysis reviews | AI Analysis |
| `get_sector_comparison` | Compare asset to sector peers | Comparison |
| `get_deep_research_report` | Comprehensive research report | Research |
| `get_company_docs` | SEC filings and transcripts | Documents |
| `search_company_docs` | Search within company documents | Documents |
| `track_topic_trend` | Track topic mentions over time | Analysis |
| `analyze_management_tone` | Analyze management sentiment | Analysis |
| `run_valuation_model` | DCF and valuation models | Valuation |
| `generate_scenario_matrix` | Scenario analysis | Valuation |
| `get_macro_context` | Macroeconomic context | Macro |
| `get_institutional_flows` | Institutional ownership flows | Flows |
| `perform_grounded_research` | Web search with citations | Research |
| `execute_python` | Execute Python code (E2B sandbox) | Compute |
| `generate_dynamic_ui` | Generate interactive UI components | UI |
| `create_and_export_document` | Create reports (Markdown/PDF) | Export |

## Context Headers

When calling tools, you can provide context via HTTP headers:

| Header | Description |
|--------|-------------|
| `x-asset-id` | Internal asset ID for company-specific queries |
| `x-ticker` | Stock ticker symbol |
| `x-chat-id` | Chat session ID for context |

## Integration Examples

### Claude Desktop

Add to your Claude Desktop config (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "stratos-brain": {
      "url": "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server",
      "transport": "http"
    }
  }
}
```

### Cursor IDE

Add to your Cursor settings:

```json
{
  "mcp.servers": [
    {
      "name": "stratos-brain",
      "url": "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server"
    }
  ]
}
```

### Python Client

```python
import requests

MCP_URL = "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/mcp-server"

def call_tool(name: str, arguments: dict) -> dict:
    response = requests.post(MCP_URL, json={
        "jsonrpc": "2.0",
        "id": "1",
        "method": "tools/call",
        "params": {
            "name": name,
            "arguments": arguments
        }
    })
    return response.json()

# Example: Get market pulse
result = call_tool("get_market_pulse", {"data_type": "overview"})
print(result)
```

## Adding External MCP Servers

To connect Stratos Brain to external MCP servers (e.g., Bloomberg, SEC Edgar):

1. Configure the server URL and API key in environment variables
2. Update the chat-worker to use the MCP client
3. Tools from external servers will be automatically discovered and available

Example configuration:
```env
MCP_BLOOMBERG_URL=https://api.bloomberg.com/mcp
MCP_BLOOMBERG_KEY=your-api-key
MCP_SEC_EDGAR_URL=https://sec-edgar-mcp.example.com
```

## Security Considerations

1. **Authentication**: The MCP server uses Supabase service role key for internal calls
2. **Rate Limiting**: Standard Supabase Edge Function rate limits apply
3. **Data Access**: Tools respect existing data access controls
4. **External Servers**: API keys for external MCP servers should be stored securely

## Future Enhancements

- [ ] OAuth 2.0 authentication for external clients
- [ ] Tool-level permissions and access control
- [ ] Streaming responses for long-running tools
- [ ] Resource subscriptions for real-time data
- [ ] Multi-tenant MCP server support
