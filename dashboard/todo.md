# Stratos Brain Dashboard To-Do List

## High Priority
- [ ] Debug API response for `/api/dashboard/inflections` to see why data is empty
- [ ] Check if `latest_dates` in health endpoint matches the data in the database
- [ ] Refactor `DataTable.tsx` to split "AI Review" into "Setup", "Attention", and "Direction" columns
- [ ] Ensure table headers align correctly with new columns

## Medium Priority - Agent Improvement Tools

### Forensic & Valuation Tools (Fundamental Alpha)
- [ ] `run_valuation_model` - Standardized DCF or Comparable Analysis tool that accepts assumptions (growth_rate, wacc) and outputs fair value range. Moves agent from "calculator" to "modeler."
- [ ] `detect_accounting_flags` - Scan 10-K filings for changes in revenue recognition, inventory methods (LIFO/FIFO), or high Beneish M-Score factors (earnings manipulation risks).
- [ ] `generate_scenario_matrix` - Python wrapper that creates sensitivity tables (e.g., EPS if Revenue drops 10% vs. rises 10%) for stress testing.

### Qualitative Insight Tools (Sentiment Alpha)
- [ ] `analyze_management_tone` - Compare semantic sentiment of current earnings call vs. previous 4 calls. Detect linguistic shifts (uncertainty words like "hopefully" vs. "we will").
- [ ] `track_topic_trend` - Longitudinal search tool for topic mentions across quarters (e.g., "How many times was 'AI' mentioned in last 8 quarters?").
- [ ] `expert_network_proxy` - Search competitor/supplier transcripts to see what others say about target company (360-degree view).

### Macro & Ecosystem Tools (Context Alpha)
- [ ] `map_supply_chain` - Use graph database or API to list key suppliers and customers. Identify contagion risk across the supply chain.
- [ ] `get_macro_context` - Fetch key macro indicators (10Y Treasury, CPI, Sector Rotations) relative to asset's beta. Prevent "market blind" analysis.
- [ ] `monitor_insider_activity` - Dedicated feed for Form 4 filings. Track insider buying/selling as conviction signal.

### Alternative Data Tools (Information Advantage)
- [ ] `get_web_traffic` - Query APIs (Semrush/SimilarWeb) for visitor trends as revenue proxy for e-commerce stocks.
- [ ] `get_app_metrics` - Query app store rankings or download estimates (Sensor Tower) for product traction signals.
- [ ] `check_gov_contracts` - Search USspending.gov for awarded government contracts. Essential for defense/industrial firms.

### Agentic Workflow Capabilities
- [ ] `devils_advocate_mode` - Once user is bullish, create rigorous "Pre-Mortem" by searching for negative news, short-seller reports, and litigation to stress-test thesis.
- [ ] `earnings_prep_pack` - Pre-earnings workflow that generates cheat sheet with consensus estimates, key questions for management, and implied move from options pricing.
- [ ] `watchdog_alerts` - Background passive agent for alerts (e.g., "Alert if [Asset] breaks 200-day MA or CEO mentions 'Investigation'").

---
# Force redeploy Fri Jan  9 23:00:44 EST 2026
