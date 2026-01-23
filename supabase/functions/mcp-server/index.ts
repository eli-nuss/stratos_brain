// Stratos Brain MCP Server
// Exposes the unified tool library via Model Context Protocol
// Enables plug-and-play integration with external MCP clients

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id, mcp-session-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// MCP Protocol Version
const MCP_VERSION = '2024-11-05'
const SERVER_NAME = 'stratos-brain-mcp'
const SERVER_VERSION = '1.0.0'

// Convert Gemini-style tool declaration to MCP tool format
function convertToMCPTool(tool: typeof UNIFIED_TOOL_DECLARATIONS[0]) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: tool.parameters.properties,
      required: tool.parameters.required || []
    }
  }
}

// Get all tools in MCP format
function getMCPTools() {
  return UNIFIED_TOOL_DECLARATIONS.map(convertToMCPTool)
}

// Handle MCP JSON-RPC requests
async function handleMCPRequest(
  request: { jsonrpc: string; id: string | number; method: string; params?: Record<string, unknown> },
  supabase: ReturnType<typeof createClient>,
  context: { assetId?: number; ticker?: string; chatId?: string }
) {
  const { id, method, params } = request

  switch (method) {
    // Initialize connection
    case 'initialize': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_VERSION,
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          },
          capabilities: {
            tools: {
              listChanged: false
            },
            resources: {
              subscribe: false,
              listChanged: false
            }
          }
        }
      }
    }

    // List available tools
    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: getMCPTools()
        }
      }
    }

    // Execute a tool
    case 'tools/call': {
      const toolName = params?.name as string
      const toolArgs = params?.arguments as Record<string, unknown> || {}

      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params: missing tool name'
          }
        }
      }

      // Find the tool
      const tool = UNIFIED_TOOL_DECLARATIONS.find(t => t.name === toolName)
      if (!tool) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool not found: ${toolName}`
          }
        }
      }

      try {
        // Execute the tool using the unified handler
        const result = await executeUnifiedTool(toolName, toolArgs, supabase, {
          assetId: context.assetId,
          ticker: context.ticker,
          chatType: 'global',
          chatId: context.chatId
        })

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ],
            isError: !!(result as { error?: string }).error
          }
        }
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Tool execution failed'
          }
        }
      }
    }

    // List resources (for future expansion)
    case 'resources/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'stratos://market/pulse',
              name: 'Market Pulse',
              description: 'Real-time market overview with gainers, losers, and sector performance',
              mimeType: 'application/json'
            },
            {
              uri: 'stratos://calendar/earnings',
              name: 'Earnings Calendar',
              description: 'Upcoming earnings dates and estimates',
              mimeType: 'application/json'
            }
          ]
        }
      }
    }

    // Read a resource
    case 'resources/read': {
      const uri = params?.uri as string
      
      if (uri === 'stratos://market/pulse') {
        const result = await executeUnifiedTool('get_market_pulse', { data_type: 'overview' }, supabase, {
          chatType: 'global'
        })
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        }
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: `Resource not found: ${uri}`
        }
      }
    }

    // Ping for health check
    case 'ping': {
      return {
        jsonrpc: '2.0',
        id,
        result: {}
      }
    }

    // Unknown method
    default: {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      }
    }
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Health check endpoint
  if (req.method === 'GET') {
    const url = new URL(req.url)
    if (url.pathname.endsWith('/health') || url.pathname.endsWith('/')) {
      return new Response(JSON.stringify({
        status: 'healthy',
        server: SERVER_NAME,
        version: SERVER_VERSION,
        protocol: MCP_VERSION,
        tools: UNIFIED_TOOL_DECLARATIONS.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // MCP requests must be POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed. Use POST for MCP requests.'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Parse request body
    const body = await req.json()

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Extract context from headers (optional)
    const assetId = req.headers.get('x-asset-id') ? parseInt(req.headers.get('x-asset-id')!) : undefined
    const ticker = req.headers.get('x-ticker') || undefined
    const chatId = req.headers.get('x-chat-id') || undefined

    const context = { assetId, ticker, chatId }

    // Handle batch requests (array of JSON-RPC requests)
    if (Array.isArray(body)) {
      const responses = await Promise.all(
        body.map(request => handleMCPRequest(request, supabase, context))
      )
      return new Response(JSON.stringify(responses), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle single request
    const response = await handleMCPRequest(body, supabase, context)
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('MCP Server error:', error)
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
