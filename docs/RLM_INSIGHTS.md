# RLM (Recursive Language Model) Insights for Daily Brief

## Key Concepts from MIT Paper

### What is RLM?
Recursive Language Models (RLMs) are an inference strategy that treats long prompts as part of an **external environment** rather than feeding them directly into the model. The LLM can programmatically examine, decompose, and recursively call itself over snippets of the prompt.

### Core Architecture
1. **REPL Environment**: Load data as a variable in a Python REPL
2. **Programmatic Access**: LLM writes code to peek into and decompose data
3. **Recursive Calls**: LLM can invoke itself on sub-tasks
4. **Iterative Observation**: Observe side effects from code execution

### Why This Matters for Daily Brief

The Daily Brief needs to analyze:
- Multiple assets (100+ stocks/crypto)
- Multiple data sources per asset (prices, signals, fundamentals, AI reviews)
- Cross-asset relationships (sector correlations, thematic clusters)
- Portfolio-level analysis

**Traditional Approach Problems:**
- Context stuffing: Degrades quality as context grows
- Lossy summarization: Loses important details
- Simple RAG: Brittle for complex reasoning

**RLM Approach Benefits:**
- Treat market data as external environment
- Programmatically query specific data points
- Decompose analysis into sub-tasks
- Maintain quality regardless of data volume

## Application to Daily Brief

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Daily Brief Agent                     │
│                  (Gemini 3 Pro Preview)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Initialize REPL Environment                          │
│     - Load all market data as structured objects         │
│     - Expose query functions for each data type          │
│                                                          │
│  2. Agent Writes Analysis Code                           │
│     - Query macro regime                                 │
│     - Filter assets by signal strength                   │
│     - Group by sector/theme                              │
│     - Calculate portfolio metrics                        │
│                                                          │
│  3. Recursive Sub-Analysis                               │
│     - For each cluster: deep dive analysis               │
│     - For each top setup: bear case analysis             │
│     - For portfolio: risk assessment                     │
│                                                          │
│  4. Synthesize Final Brief                               │
│     - Aggregate sub-analyses                             │
│     - Generate structured JSON output                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Implementation Strategy

Instead of dumping all data into context, we:

1. **Create Data Access Functions**
   ```typescript
   // Functions the agent can call
   get_macro_regime() → MacroData
   get_top_signals(n: number, direction: string) → Signal[]
   get_assets_by_sector(sector: string) → Asset[]
   get_portfolio_holdings() → Holding[]
   get_asset_details(symbol: string) → AssetDetails
   ```

2. **Let Agent Decide What to Query**
   - Agent first gets high-level overview
   - Decides which areas need deeper analysis
   - Queries specific data as needed
   - Recursively analyzes sub-topics

3. **Structured Output**
   - Agent produces JSON matching our schema
   - Each section generated with focused context
   - Quality maintained regardless of total data volume

### Key Guardrails (from paper)

1. **Limit recursion depth** - Prevent runaway loops
2. **Use high-performance model** - Gemini 3 Pro Preview
3. **Careful prompt engineering** - Clear instructions for evaluation
4. **Not universal** - Simpler approaches for simple tasks

## Practical Changes to Daily Brief Plan

### Before (Context Stuffing)
```
Prompt: "Here's ALL the data: [100KB of JSON]... Now analyze it"
Problem: Context rot, lost details, degraded quality
```

### After (RLM-Inspired)
```
Prompt: "You have access to these functions to query market data.
         First, get the macro regime. Then identify top signals.
         For each interesting cluster, do a deep analysis.
         Generate the daily brief section by section."
         
Agent: Writes code to query data, analyzes incrementally,
       synthesizes final output
```

### Section-by-Section Generation

Instead of generating entire brief at once:

1. **Market Pulse**: Query macro + indices → Generate section
2. **Technical Clusters**: Query signals → Group → Analyze each → Generate section
3. **Portfolio**: Query holdings → Calculate metrics → Analyze → Generate section
4. **Action Items**: Synthesize all sections → Prioritize → Generate section

Each section gets focused context, maintaining quality.

## Implementation Checklist Updates

- [ ] Create data access layer with query functions
- [ ] Implement section-by-section generation
- [ ] Add recursion depth limits
- [ ] Use function calling for data access
- [ ] Cache intermediate results
- [ ] Implement sub-agent calls for deep analysis
