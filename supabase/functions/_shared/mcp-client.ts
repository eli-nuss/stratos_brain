// MCP Client for Stratos Brain
// Connects to internal and external MCP servers to discover and execute tools

const MCP_VERSION = '2024-11-05'

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPServer {
  name: string
  url: string
  apiKey?: string
  tools?: MCPTool[]
  connected: boolean
}

export interface MCPToolResult {
  content: Array<{
    type: string
    text?: string
    data?: unknown
  }>
  isError?: boolean
}

// JSON-RPC request helper
async function jsonRpcRequest(
  url: string,
  method: string,
  params?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params
    })
  })

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  
  if (result.error) {
    throw new Error(`MCP error: ${result.error.message}`)
  }

  return result.result
}

export class MCPClient {
  private servers: Map<string, MCPServer> = new Map()
  private toolRegistry: Map<string, { server: MCPServer; tool: MCPTool }> = new Map()

  // Add an MCP server
  async addServer(name: string, url: string, apiKey?: string): Promise<void> {
    const server: MCPServer = {
      name,
      url,
      apiKey,
      connected: false
    }

    try {
      // Initialize connection
      const initResult = await jsonRpcRequest(
        url,
        'initialize',
        {
          protocolVersion: MCP_VERSION,
          clientInfo: {
            name: 'stratos-brain-client',
            version: '1.0.0'
          },
          capabilities: {}
        },
        apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined
      ) as { protocolVersion: string; serverInfo: { name: string; version: string } }

      console.log(`Connected to MCP server: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`)

      // List available tools
      const toolsResult = await jsonRpcRequest(
        url,
        'tools/list',
        {},
        apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined
      ) as { tools: MCPTool[] }

      server.tools = toolsResult.tools
      server.connected = true

      // Register tools in the global registry
      for (const tool of toolsResult.tools) {
        const qualifiedName = `${name}:${tool.name}`
        this.toolRegistry.set(qualifiedName, { server, tool })
        // Also register without prefix for backward compatibility
        if (!this.toolRegistry.has(tool.name)) {
          this.toolRegistry.set(tool.name, { server, tool })
        }
      }

      this.servers.set(name, server)
      console.log(`Registered ${toolsResult.tools.length} tools from ${name}`)

    } catch (error) {
      console.error(`Failed to connect to MCP server ${name}:`, error)
      server.connected = false
      this.servers.set(name, server)
    }
  }

  // Get all available tools across all servers
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = []
    const seen = new Set<string>()

    for (const [, { tool }] of this.toolRegistry) {
      if (!seen.has(tool.name)) {
        tools.push(tool)
        seen.add(tool.name)
      }
    }

    return tools
  }

  // Get tools in Gemini function declaration format
  getToolsAsGeminiFunctions(): Array<{
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.inputSchema.type,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required || []
      }
    }))
  }

  // Execute a tool
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: { assetId?: number; ticker?: string; chatId?: string }
  ): Promise<MCPToolResult> {
    const registration = this.toolRegistry.get(toolName)
    
    if (!registration) {
      return {
        content: [{ type: 'text', text: `Tool not found: ${toolName}` }],
        isError: true
      }
    }

    const { server } = registration

    if (!server.connected) {
      return {
        content: [{ type: 'text', text: `Server ${server.name} is not connected` }],
        isError: true
      }
    }

    try {
      const headers: Record<string, string> = {}
      if (server.apiKey) {
        headers['Authorization'] = `Bearer ${server.apiKey}`
      }
      if (context?.assetId) {
        headers['x-asset-id'] = context.assetId.toString()
      }
      if (context?.ticker) {
        headers['x-ticker'] = context.ticker
      }
      if (context?.chatId) {
        headers['x-chat-id'] = context.chatId
      }

      const result = await jsonRpcRequest(
        server.url,
        'tools/call',
        {
          name: toolName,
          arguments: args
        },
        headers
      ) as MCPToolResult

      return result

    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }],
        isError: true
      }
    }
  }

  // Get server status
  getServerStatus(): Array<{ name: string; connected: boolean; toolCount: number }> {
    return Array.from(this.servers.values()).map(server => ({
      name: server.name,
      connected: server.connected,
      toolCount: server.tools?.length || 0
    }))
  }

  // Disconnect from all servers
  disconnect(): void {
    this.servers.clear()
    this.toolRegistry.clear()
  }
}

// Create a singleton instance for the internal MCP server
export async function createInternalMCPClient(): Promise<MCPClient> {
  const client = new MCPClient()
  
  // Connect to the internal Stratos Brain MCP server
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const internalMcpUrl = `${supabaseUrl}/functions/v1/mcp-server`
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  
  await client.addServer('stratos-internal', internalMcpUrl, serviceKey)
  
  return client
}

// Factory function to create MCP client with custom servers
export async function createMCPClient(servers: Array<{ name: string; url: string; apiKey?: string }>): Promise<MCPClient> {
  const client = new MCPClient()
  
  for (const server of servers) {
    await client.addServer(server.name, server.url, server.apiKey)
  }
  
  return client
}
