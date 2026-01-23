// Agent Orchestrator for the "Skeptic" Agent Loop
// Coordinates Scout, Quant, and Skeptic agents in a sequential workflow

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import {
  AgentState,
  AgentOutput,
  SkepticVerdict,
  createAgentState,
  advancePhase,
  recordAgentOutput,
  recordSkepticVerdict,
  handleRetry,
  shouldSkipSkeptic,
  classifyQuery,
  getAgentSummary,
  SCOUT_TOOLS,
  QUANT_TOOLS
} from './agent-state.ts';
import {
  buildScoutPrompt,
  buildQuantPrompt,
  buildSkepticPrompt,
  buildFinalResponsePrompt,
  buildSimpleQueryPrompt
} from './agent-prompts.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL_FLASH = 'gemini-3-flash-preview';
const GEMINI_MODEL_PRO = 'gemini-3-pro-preview';

// Agent model assignments
const AGENT_MODELS = {
  scout: GEMINI_MODEL_FLASH,   // Fast for research
  quant: GEMINI_MODEL_PRO,     // Powerful for calculations
  skeptic: GEMINI_MODEL_FLASH, // Fast for validation
  final: GEMINI_MODEL_FLASH    // Fast for synthesis
};

// ============================================================================
// TYPES
// ============================================================================

interface Asset {
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: string;
  sector?: string;
  industry?: string;
}

interface OrchestratorResult {
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  agentSummary: string;
  skepticVerdict: SkepticVerdict | null;
  retryCount: number;
}

type ExecuteFunctionCallback = (
  supabase: ReturnType<typeof createClient>,
  functionName: string,
  args: Record<string, unknown>,
  jobId: string
) => Promise<unknown>;

type BroadcastCallback = (
  jobId: string,
  event: string,
  payload: Record<string, unknown>
) => Promise<void>;

// ============================================================================
// GEMINI API HELPERS
// ============================================================================

async function callGeminiAgent(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  functionDeclarations: unknown[],
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  executeFunction: ExecuteFunctionCallback,
  broadcast: BroadcastCallback,
  agentName: string
): Promise<{ response: string; toolCalls: unknown[]; codeExecutions: unknown[]; latencyMs: number }> {
  const startTime = Date.now();
  const toolCalls: unknown[] = [];
  const codeExecutions: unknown[] = [];
  
  // Broadcast agent start
  await broadcast(jobId, 'agent_start', { agent: agentName, model });
  
  const requestBody: Record<string, unknown> = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: agentName === 'quant' ? 0.3 : 0.7, // Lower temp for calculations
      maxOutputTokens: 8192,
      candidateCount: 1
    }
  };
  
  // Only include tools if agent has them
  if (functionDeclarations.length > 0) {
    requestBody.tools = [{ functionDeclarations }];
  }
  
  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${agentName}): ${response.status} - ${errorText.substring(0, 500)}`);
  }
  
  let data = await response.json();
  let candidate = data.candidates?.[0];
  
  const maxIterations = 10;
  let iteration = 0;
  
  // Tool execution loop
  while (candidate && iteration < maxIterations) {
    const content = candidate.content;
    const functionCallParts = content?.parts?.filter((p: { functionCall?: unknown }) => p.functionCall) || [];
    
    if (functionCallParts.length === 0) break;
    
    // Add model's function call to messages
    messages.push({
      role: 'model',
      parts: functionCallParts
    });
    
    // Execute each function call
    const functionResponses: Array<{ functionResponse: { name: string; response: unknown } }> = [];
    
    for (const part of functionCallParts) {
      const fc = part.functionCall as { name: string; args: Record<string, unknown> };
      
      // Broadcast tool start
      await broadcast(jobId, 'tool_start', { 
        agent: agentName, 
        tool: fc.name, 
        args: fc.args 
      });
      
      const result = await executeFunction(supabase, fc.name, fc.args, jobId);
      
      // Broadcast tool complete
      await broadcast(jobId, 'tool_complete', { 
        agent: agentName, 
        tool: fc.name, 
        success: true 
      });
      
      toolCalls.push({
        agent: agentName,
        name: fc.name,
        args: fc.args,
        result
      });
      
      if (fc.name === 'execute_python') {
        codeExecutions.push({
          agent: agentName,
          code: fc.args.code,
          purpose: fc.args.purpose,
          result
        });
      }
      
      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: result
        }
      });
    }
    
    // Add function responses to messages
    messages.push({
      role: 'user',
      parts: functionResponses
    });
    
    // Call Gemini again
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          contents: messages
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error (${agentName}): ${response.status}`);
    }
    
    data = await response.json();
    candidate = data.candidates?.[0];
    iteration++;
  }
  
  // Extract final text response
  const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || [];
  const finalResponse = textParts.map((p: { text: string }) => p.text).join('\n');
  
  const latencyMs = Date.now() - startTime;
  
  // Broadcast agent complete
  await broadcast(jobId, 'agent_complete', { 
    agent: agentName, 
    latencyMs,
    toolCallCount: toolCalls.length 
  });
  
  return {
    response: finalResponse,
    toolCalls,
    codeExecutions,
    latencyMs
  };
}

// ============================================================================
// SKEPTIC VALIDATION
// ============================================================================

async function runSkepticValidation(
  asset: Asset,
  scoutFindings: string,
  quantAnalysis: string,
  originalQuery: string,
  jobId: string,
  broadcast: BroadcastCallback
): Promise<SkepticVerdict> {
  const startTime = Date.now();
  
  await broadcast(jobId, 'agent_start', { agent: 'skeptic', model: AGENT_MODELS.skeptic });
  
  const systemPrompt = buildSkepticPrompt(
    { symbol: asset.symbol, name: asset.name },
    scoutFindings,
    quantAnalysis,
    originalQuery
  );
  
  const messages = [
    {
      role: 'user',
      parts: [{ text: 'Please validate the analysis and provide your verdict.' }]
    }
  ];
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AGENT_MODELS.skeptic}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.3, // Low temp for consistent validation
          maxOutputTokens: 2048,
          candidateCount: 1
        }
      })
    }
  );
  
  if (!response.ok) {
    // If skeptic fails, default to PASS to avoid blocking
    console.error('Skeptic API error, defaulting to PASS');
    return {
      verdict: 'PASS',
      confidence: 70,
      issues: ['Skeptic validation failed - defaulting to PASS'],
      corrections: [],
      reasoning: 'Skeptic agent encountered an error'
    };
  }
  
  const data = await response.json();
  const textParts = data.candidates?.[0]?.content?.parts?.filter((p: { text?: string }) => p.text) || [];
  const rawResponse = textParts.map((p: { text: string }) => p.text).join('\n');
  
  const latencyMs = Date.now() - startTime;
  
  await broadcast(jobId, 'agent_complete', { 
    agent: 'skeptic', 
    latencyMs 
  });
  
  // Parse the JSON response
  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                      rawResponse.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      return {
        verdict: parsed.verdict === 'PASS' ? 'PASS' : 'FAIL',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    }
  } catch (e) {
    console.error('Failed to parse skeptic response:', e);
  }
  
  // Default to PASS if parsing fails
  return {
    verdict: 'PASS',
    confidence: 75,
    issues: ['Could not parse skeptic response'],
    corrections: [],
    reasoning: rawResponse.substring(0, 500)
  };
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export async function runAgentOrchestrator(
  supabase: ReturnType<typeof createClient>,
  asset: Asset,
  userMessage: string,
  conversationHistory: Array<{ role: string; parts: Array<{ text?: string }> }>,
  contextSnapshot: unknown,
  jobId: string,
  allFunctionDeclarations: unknown[],
  executeFunction: ExecuteFunctionCallback,
  broadcast: BroadcastCallback,
  enableSkeptic: boolean = true
): Promise<OrchestratorResult> {
  
  // Classify the query
  const queryType = classifyQuery(userMessage);
  
  // Check if we should skip the multi-agent loop for simple queries
  if (shouldSkipSkeptic({ phase: 'scout' } as AgentState, userMessage) || queryType === 'simple') {
    // Use simple single-agent flow
    const systemPrompt = buildSimpleQueryPrompt(asset, contextSnapshot);
    const messages = [...conversationHistory];
    
    const result = await callGeminiAgent(
      AGENT_MODELS.scout,
      systemPrompt,
      messages,
      allFunctionDeclarations,
      supabase,
      jobId,
      executeFunction,
      broadcast,
      'simple'
    );
    
    return {
      response: result.response,
      toolCalls: result.toolCalls,
      codeExecutions: result.codeExecutions,
      agentSummary: `[Simple query] ${result.latencyMs}ms`,
      skepticVerdict: null,
      retryCount: 0
    };
  }
  
  // Initialize agent state
  let state = createAgentState({ maxRetries: 2 });
  let allToolCalls: unknown[] = [];
  let allCodeExecutions: unknown[] = [];
  
  // Broadcast orchestrator start
  await broadcast(jobId, 'orchestrator_start', { 
    queryType, 
    enableSkeptic,
    phases: ['scout', 'quant', 'skeptic'] 
  });
  
  // Filter function declarations for each agent
  const scoutDeclarations = allFunctionDeclarations.filter(
    (fd: unknown) => SCOUT_TOOLS.includes((fd as { name: string }).name)
  );
  const quantDeclarations = allFunctionDeclarations.filter(
    (fd: unknown) => QUANT_TOOLS.includes((fd as { name: string }).name)
  );
  
  // Main agent loop with retry logic
  while (state.phase !== 'complete' && state.phase !== 'failed') {
    try {
      switch (state.phase) {
        case 'scout': {
          // Run Scout Agent
          const scoutPrompt = buildScoutPrompt(asset, queryType, contextSnapshot);
          const scoutMessages = [
            ...conversationHistory,
            { role: 'user', parts: [{ text: userMessage }] }
          ];
          
          const scoutResult = await callGeminiAgent(
            AGENT_MODELS.scout,
            scoutPrompt,
            scoutMessages,
            scoutDeclarations,
            supabase,
            jobId,
            executeFunction,
            broadcast,
            'scout'
          );
          
          state = recordAgentOutput(state, 'scout', {
            content: scoutResult.response,
            toolCalls: scoutResult.toolCalls,
            codeExecutions: scoutResult.codeExecutions,
            latencyMs: scoutResult.latencyMs
          });
          
          allToolCalls = [...allToolCalls, ...scoutResult.toolCalls];
          allCodeExecutions = [...allCodeExecutions, ...scoutResult.codeExecutions];
          
          state = advancePhase(state);
          break;
        }
        
        case 'quant': {
          // Run Quant Agent
          const scoutFindings = state.scoutOutput?.content || 'No scout findings available.';
          const quantPrompt = buildQuantPrompt(asset, scoutFindings, queryType);
          const quantMessages = [
            { role: 'user', parts: [{ text: `Based on the Scout's research, please perform the analysis for: "${userMessage}"` }] }
          ];
          
          const quantResult = await callGeminiAgent(
            AGENT_MODELS.quant,
            quantPrompt,
            quantMessages,
            quantDeclarations,
            supabase,
            jobId,
            executeFunction,
            broadcast,
            'quant'
          );
          
          state = recordAgentOutput(state, 'quant', {
            content: quantResult.response,
            toolCalls: quantResult.toolCalls,
            codeExecutions: quantResult.codeExecutions,
            latencyMs: quantResult.latencyMs
          });
          
          allToolCalls = [...allToolCalls, ...quantResult.toolCalls];
          allCodeExecutions = [...allCodeExecutions, ...quantResult.codeExecutions];
          
          state = advancePhase(state);
          break;
        }
        
        case 'skeptic': {
          if (!enableSkeptic) {
            // Skip skeptic if disabled
            state = advancePhase(state);
            break;
          }
          
          // Run Skeptic Agent
          const scoutFindings = state.scoutOutput?.content || '';
          const quantAnalysis = state.quantOutput?.content || '';
          
          const verdict = await runSkepticValidation(
            asset,
            scoutFindings,
            quantAnalysis,
            userMessage,
            jobId,
            broadcast
          );
          
          state = recordSkepticVerdict(state, verdict);
          
          if (verdict.verdict === 'FAIL' && state.retryCount < state.maxRetries) {
            // Retry with corrections
            await broadcast(jobId, 'skeptic_fail', { 
              issues: verdict.issues,
              corrections: verdict.corrections,
              retryCount: state.retryCount + 1
            });
            
            state = handleRetry(state, `Skeptic failed: ${verdict.issues.join(', ')}`);
          } else {
            state = advancePhase(state);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Agent error in phase ${state.phase}:`, error);
      state = handleRetry(state, String(error));
    }
  }
  
  // Generate final response
  let finalResponse: string;
  
  if (state.phase === 'failed') {
    finalResponse = `I apologize, but I encountered difficulties completing the analysis after ${state.retryCount} attempts. Here's what I was able to gather:\n\n`;
    
    if (state.scoutOutput?.content) {
      finalResponse += `## Research Findings\n${state.scoutOutput.content}\n\n`;
    }
    if (state.quantOutput?.content) {
      finalResponse += `## Analysis\n${state.quantOutput.content}\n\n`;
    }
    
    finalResponse += `\n---\n*Note: This analysis may be incomplete. Please verify the information independently.*`;
  } else {
    // Synthesize final response
    const scoutFindings = state.scoutOutput?.content || '';
    const quantAnalysis = state.quantOutput?.content || '';
    
    // Always run synthesis to generate a proper response
    // This ensures we get a coherent response even if agents only made tool calls
    const synthesisPrompt = buildFinalResponsePrompt(
      { symbol: asset.symbol, name: asset.name },
      scoutFindings || 'Research data gathered via tool calls.',
      quantAnalysis || 'Analysis performed via tool calls.',
      state.skepticVerdict,
      userMessage
    );
    
    const synthesisResult = await callGeminiAgent(
      AGENT_MODELS.final,
      synthesisPrompt,
      [{ role: 'user', parts: [{ text: `Please synthesize a comprehensive response to: "${userMessage}"` }] }],
      [],
      supabase,
      jobId,
      executeFunction,
      broadcast,
      'synthesis'
    );
    
    finalResponse = synthesisResult.response;
    
    // Fallback if synthesis also returns empty
    if (!finalResponse || finalResponse.trim() === '') {
      if (quantAnalysis && scoutFindings) {
        finalResponse = `## Analysis\n${quantAnalysis}\n\n---\n\n## Research Context\n${scoutFindings}`;
      } else if (quantAnalysis) {
        finalResponse = quantAnalysis;
      } else if (scoutFindings) {
        finalResponse = scoutFindings;
      } else {
        finalResponse = 'I completed the analysis but was unable to generate a summary. Please try rephrasing your question.';
      }
    }
  }
  
  // Broadcast orchestrator complete
  await broadcast(jobId, 'orchestrator_complete', { 
    summary: getAgentSummary(state),
    verdict: state.skepticVerdict?.verdict || 'N/A',
    retryCount: state.retryCount
  });
  
  // Broadcast done event with full text (required for frontend to display response)
  await broadcast(jobId, 'done', { 
    full_text: finalResponse,
    agent_summary: getAgentSummary(state),
    skeptic_verdict: state.skepticVerdict
  });
  
  return {
    response: finalResponse,
    toolCalls: allToolCalls,
    codeExecutions: allCodeExecutions,
    agentSummary: getAgentSummary(state),
    skepticVerdict: state.skepticVerdict,
    retryCount: state.retryCount
  };
}
