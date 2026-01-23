// Agent State Manager for the "Skeptic" Agent Loop
// Implements a multi-agent quality control system with Scout, Quant, and Skeptic agents

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AgentPhase = 'scout' | 'quant' | 'skeptic' | 'complete' | 'failed';

export interface SkepticVerdict {
  verdict: 'PASS' | 'FAIL';
  confidence: number; // 0-100
  issues: string[];
  corrections: string[];
  reasoning: string;
}

export interface AgentOutput {
  agent: 'scout' | 'quant' | 'skeptic';
  content: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  latencyMs: number;
  timestamp: string;
}

export interface AgentState {
  phase: AgentPhase;
  scoutOutput: AgentOutput | null;
  quantOutput: AgentOutput | null;
  skepticVerdict: SkepticVerdict | null;
  retryCount: number;
  maxRetries: number;
  history: AgentOutput[];
  errors: string[];
  startTime: number;
}

export interface AgentConfig {
  enableSkeptic: boolean;
  maxRetries: number;
  skipScoutForSimpleQueries: boolean;
  skepticThreshold: number; // Minimum confidence to pass (0-100)
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export function createAgentState(config?: Partial<AgentConfig>): AgentState {
  return {
    phase: 'scout',
    scoutOutput: null,
    quantOutput: null,
    skepticVerdict: null,
    retryCount: 0,
    maxRetries: config?.maxRetries ?? 2,
    history: [],
    errors: [],
    startTime: Date.now()
  };
}

export function advancePhase(state: AgentState): AgentState {
  const phaseOrder: AgentPhase[] = ['scout', 'quant', 'skeptic', 'complete'];
  const currentIndex = phaseOrder.indexOf(state.phase);
  
  if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
    return { ...state, phase: 'complete' };
  }
  
  return { ...state, phase: phaseOrder[currentIndex + 1] };
}

export function recordAgentOutput(
  state: AgentState,
  agent: 'scout' | 'quant' | 'skeptic',
  output: Omit<AgentOutput, 'agent' | 'timestamp'>
): AgentState {
  const agentOutput: AgentOutput = {
    ...output,
    agent,
    timestamp: new Date().toISOString()
  };
  
  const newState = { ...state, history: [...state.history, agentOutput] };
  
  switch (agent) {
    case 'scout':
      return { ...newState, scoutOutput: agentOutput };
    case 'quant':
      return { ...newState, quantOutput: agentOutput };
    default:
      return newState;
  }
}

export function recordSkepticVerdict(
  state: AgentState,
  verdict: SkepticVerdict
): AgentState {
  return { ...state, skepticVerdict: verdict };
}

export function handleRetry(state: AgentState, error?: string): AgentState {
  const newErrors = error ? [...state.errors, error] : state.errors;
  
  if (state.retryCount >= state.maxRetries) {
    return { 
      ...state, 
      phase: 'failed', 
      errors: newErrors,
      retryCount: state.retryCount + 1 
    };
  }
  
  // Reset to scout phase for retry
  return {
    ...state,
    phase: 'scout',
    scoutOutput: null,
    quantOutput: null,
    skepticVerdict: null,
    retryCount: state.retryCount + 1,
    errors: newErrors
  };
}

export function shouldSkipSkeptic(state: AgentState, query: string): boolean {
  // Skip skeptic for simple queries that don't require validation
  const simplePatterns = [
    /^(hi|hello|hey|thanks|thank you)/i,
    /^what is your name/i,
    /^who are you/i,
    /^help$/i
  ];
  
  return simplePatterns.some(pattern => pattern.test(query.trim()));
}

export function getAgentSummary(state: AgentState): string {
  const elapsed = Date.now() - state.startTime;
  const phases = state.history.map(h => `${h.agent}(${h.latencyMs}ms)`).join(' → ');
  
  return `[${elapsed}ms total] ${phases} | Retries: ${state.retryCount}/${state.maxRetries}`;
}

// ============================================================================
// QUERY CLASSIFICATION
// ============================================================================

export type QueryType = 'research' | 'calculation' | 'simple' | 'hybrid';

export function classifyQuery(query: string): QueryType {
  const lowerQuery = query.toLowerCase();
  
  // Calculation-heavy queries
  const calcPatterns = [
    /calculate/i,
    /dcf/i,
    /valuation/i,
    /fair value/i,
    /intrinsic value/i,
    /model/i,
    /forecast/i,
    /project/i,
    /estimate/i,
    /what.*(price|value|worth)/i,
    /how much/i,
    /ratio/i,
    /margin/i,
    /growth rate/i
  ];
  
  // Research-heavy queries
  const researchPatterns = [
    /why/i,
    /what happened/i,
    /news/i,
    /recent/i,
    /latest/i,
    /explain/i,
    /tell me about/i,
    /overview/i,
    /summary/i,
    /compare/i,
    /vs/i,
    /versus/i
  ];
  
  const isCalc = calcPatterns.some(p => p.test(lowerQuery));
  const isResearch = researchPatterns.some(p => p.test(lowerQuery));
  
  if (isCalc && isResearch) return 'hybrid';
  if (isCalc) return 'calculation';
  if (isResearch) return 'research';
  return 'simple';
}

// ============================================================================
// TOOL ROUTING
// ============================================================================

// Tools available to each agent
export const SCOUT_TOOLS = [
  'web_search',
  'get_company_docs',
  'search_company_docs',
  'get_market_pulse',
  'get_macro_context',
  'get_asset_fundamentals',
  'get_price_history'
];

export const QUANT_TOOLS = [
  'execute_python',
  'run_valuation_model',
  'generate_scenario_matrix',
  'get_asset_fundamentals',
  'get_price_history',
  'get_technical_indicators',
  'analyze_earnings_tone',
  'get_sector_comparison'
];

export const SKEPTIC_TOOLS: string[] = []; // Skeptic has no tools - only reviews

export function getToolsForAgent(agent: 'scout' | 'quant' | 'skeptic'): string[] {
  switch (agent) {
    case 'scout':
      return SCOUT_TOOLS;
    case 'quant':
      return QUANT_TOOLS;
    case 'skeptic':
      return SKEPTIC_TOOLS;
  }
}
