# Daily Brief Research Notes

## Guide Summary: Agentic Daily Brief Architecture

### Core Concept
- Move from linear script to **Gemini 3 Pro Preview agent** as "Chief of Staff"
- Agent actively researches, correlates, and reasons to build the brief
- Uses **Chain of Thought (CoT)** reasoning before generating final output

### Architecture Components

#### 1. Agent Persona: "Stratos CIO Agent"
- **Philosophy:**
  - Alpha Over Noise: Explain *why* moves happened and if tradeable
  - Skepticism First: Hunt for bear case on every bullish setup
  - Thematic Clusters: Group setups by theme (stocks rarely move alone)

- **Process (CoT):**
  1. Macro Scan - Check regime (Risk-On/Risk-Off)
  2. Quant Harvest - Identify highest purity (>90) signals
  3. Thematic Grouping - 3+ assets from same industry = Cluster
  4. Fundamental Filter - FVS < 40 = "Speculative Momentum", FVS > 60 = "Quality Growth"
  5. Final Synthesis - Generate structured JSON

#### 2. Required Tools
1. **fetch_quant_alpha** - Raw signal data from setup_signals + daily_features
2. **fetch_fundamental_health** - Quality filter from fundamental_vigor_scores
3. **get_macro_regime** - Vibe check from macro_context table

#### 3. Output Schema
```json
{
  "market_pulse": {
    "regime": "Risk-On/Risk-Off",
    "summary": "...",
    "dominant_theme": "..."
  },
  "technical_clusters": [
    {
      "theme_name": "...",
      "urgency": "HIGH/MEDIUM/LOW",
      "description": "...",
      "assets": [...]
    }
  ],
  "individual_setups": [...],
  "skeptics_corner": [...]
}
```

#### 4. Key Rules
- Never recommend asset with < $5M daily volume without "Liquidity Warning"
- "Urgency" reserved for Fresh Breakouts (Day 1) or Critical Support Tests

---

## Research Tasks
- [ ] Gemini 3 API capabilities and tools
- [ ] Existing database schema review
- [ ] MCP server review (company chats, brain chats)
- [ ] Define all useful sections for fund managers
