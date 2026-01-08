# E2B Integration Notes

## Key Findings from SDK Source Code

### REST API Endpoint Discovery
From `sandbox.ts` in the E2B code-interpreter SDK:

The SDK uses HTTP fetch to communicate with the sandbox. Key endpoints:

1. **Execute Code**: `POST ${jupyterUrl}/execute`
   ```javascript
   const res = await fetch(`${this.jupyterUrl}/execute`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'E2B-Traffic-Access-Token': this.trafficAccessToken, // optional
       'X-Access-Token': this.envdAccessToken, // optional
     },
     body: JSON.stringify({
       code,
       context_id: opts?.context?.id,
       language: opts?.language,
       env_vars: opts?.envs,
     }),
   })
   ```

2. **Create Context**: `POST ${jupyterUrl}/contexts`
   ```javascript
   const res = await fetch(`${this.jupyterUrl}/contexts`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       language: opts?.language,
       cwd: opts?.cwd,
     }),
   })
   ```

### Sandbox URL Format
```javascript
jupyterUrl = `https://${sandboxId}.e2b.dev:${JUPYTER_PORT}`
// JUPYTER_PORT is typically 8888
```

### SDK Usage (JavaScript/TypeScript)
```javascript
import { Sandbox } from '@e2b/code-interpreter'

const sbx = await Sandbox.create() // Sandbox alive for 5 minutes by default
const execution = await sbx.runCode('print("hello world")') // Execute Python
console.log(execution.logs)
```

### API Key
- Requires `E2B_API_KEY` environment variable
- Get from E2B Dashboard: https://e2b.dev/dashboard?tab=keys

## Integration Approach for Supabase Edge Functions

### Option 1: Use E2B JavaScript SDK with npm: specifier in Deno
```typescript
import { Sandbox } from "npm:@e2b/code-interpreter";

Deno.env.set("E2B_API_KEY", "your-api-key");

const sandbox = await Sandbox.create();
const execution = await sandbox.runCode(code);
await sandbox.kill();

return {
  success: true,
  output: execution.logs.stdout.join("\n"),
  error: execution.error?.message || null,
};
```

### Option 2: Direct REST API (if SDK doesn't work in Deno)
The SDK extends `BaseSandbox` from `e2b` package which handles:
- Creating sandbox instances
- Managing sandbox lifecycle
- Authentication with E2B API

The code execution happens via HTTP POST to the sandbox's Jupyter endpoint.

## Implementation Plan
1. Try importing E2B SDK in Supabase Edge Function using `npm:` specifier
2. Create `execute_python` function wrapper
3. Handle sandbox lifecycle (create, execute, kill)
4. Return execution results to Gemini
