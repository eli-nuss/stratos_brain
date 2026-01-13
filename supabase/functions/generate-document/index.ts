// Supabase Edge Function: Gemini-based Document Generation
// Generates investment memos, one-pagers, and deep research reports using Gemini 3 Pro with Google Search grounding
//
// This replaces the Manus-based document generation with a synchronous Gemini approach.
// The function fetches asset data from the control-api, then uses Gemini with web search
// to generate comprehensive investment documents.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// ==================== TEMPLATES ====================

const MEMO_TEMPLATE = `# Investment Memo: [Company Name] (Ticker)

Date: [Date] | Analyst: Stratos Brain AI

Recommendation: [Long / Short / Watch] | Conviction: [High / Medium / Low]

## Market Data Snapshot

*[Agent Instruction: Determine which valuation multiples make sense based on the business. What does it seem to trade off of or what do similar companies seem to trade based on?]*

| Metric | Value | Metric | Value |
|--------|-------|--------|-------|
| Current Price | $[Price] | Market Cap | $[X]B |
| [P/E (TTM) OR P/Sales, etc.] | [X]x | [P/E (Fwd) OR EV/Rev, etc.] | [X]x |
| [FCF Yield OR Cash Runway, etc.] | [X] | [ROIC OR Gross Margin, etc.] | [X] |
| 1-Year Return | [X]% | 3-Year Return | [X]% |
| 5-Year Return | [X]% | Trend Signal | [Bullish/Bearish] |

---

## 1. Executive Summary: The "Why Now?"

### The Hook & Opportunity
- **The Thesis in 2 Sentences:** [Succinctly state the core opportunity.]
- **Why Now?:** [Why does this opportunity exist *today*? e.g., "Stock fell 20% on temporary news," "New CEO," "Regulatory change."]
- **Consensus vs. Reality:**
  - *Market View:* [What the consensus believes.]
  - *Our View:* [How we differ.]
  - *The Gap:* [The specific misunderstanding creating the alpha.]

### Synthesized Target Price

| Methodology | Price Target | Weighting | Implied Upside |
|-------------|--------------|-----------|----------------|
| Fundamental (Multiple Re-rating) | $[Price] | 40% | [X]% |
| Fundamental (DCF/Consensus) | $[Price] | 40% | [X]% |
| Technical (Resistance/Support) | $[Price] | 20% | [X]% |
| **BLENDED TARGET** | **$[Price]** | **100%** | **[Total Upside]%** |

---

## 2. Business Overview & Segment Analysis

### Business Models by Segment
*[Agent Instruction: Briefly explain what each division actually does and how it makes money (e.g., "Subscription SaaS" vs "One-time Hardware Sales").]*

- **Segment A ([Name]):** [Description of business model].
- **Segment B ([Name]):** [Description of business model].
- **Segment C ([Name]):** [Description of business model].

### Segment Performance (5-Year Lookback)

| Segment Revenue ($M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | CAGR (3y) |
|---------------------|------|------|------|------|------|-----------|
| [Segment A] | | | | | | |
| [Segment B] | | | | | | |
| [Total Revenue] | | | | | | |

---

## 3. Financial Snapshot (Historical + TTM + Estimates)

- **Valuation Context:**
  - **Current Valuation:** [P/E or P/Sales] is [X]x (vs. 5yr Avg: [Y]x) — *[Premium/Discount Analysis]*
  - **Efficiency:** [ROIC or Gross Margin Trend analysis]
- **Liquidity & Quality:**
  - **Cash Position:** $[X]M Cash vs $[Y]M Debt.
  - **Quality of Earnings:** Is growth driven by volume (good) or just price (risk)?

| Metric (USD M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | TTM (LTM) | FY+1 (Est) | FY+2 (Est) |
|----------------|------|------|------|------|------|-----------|------------|------------|
| Revenue | | | | | | | | |
| Growth % | | | | | | | | |
| Gross Margin % | | | | | | | | |
| EBITDA | | | | | | | | |
| Free Cash Flow | | | | | | | | |

---

## 4. Strategic Quality & Moat (Counterpoint Analysis)

### A. Return on Invested Capital (ROIC)
- **Trend:** Is ROIC rising, falling, or stable? Why?
- **Sustainability:** Is the ROIC supported by structural advantages (patents, scale) or temporary factors?

### B. Competitive Advantage (The Moat)
- **Pricing Power:** Evidence of price hikes above inflation without churn?
- **Barriers to Entry:**
  - *Scale:* Does Minimum Efficient Scale (MES) prevent new entrants?
  - *Switching Costs:* Is there high customer lock-in? (Retention rates).
- **Disruption Risk:** Vertical integration risks or horizontal shifts?

### C. Industry Structure
- **Consolidation:** Is the industry consolidating (good for profits) or fragmenting?
- **Rationality:** Do competitors act rationally regarding pricing and capacity?
- **Government Role:** Tariff exposure, antitrust risks, or subsidy reliance.

### D. Competitors
- **Competition:** List the major competitors and their market share
- **Share Gains:** How has market share evolved over the past 3 years?
- **Projected share:** How is market share expected to evolve in the next 3 years?

---

## 5. Management & Governance Analysis ("Say/Do" Audit)

### Recent Focus (Last 4 Quarters)
*[Agent Instruction: Analyze the last 4 earnings calls. What changed quarter-to-quarter?]*

- **Q1 [Year]:** Key Theme: [e.g., "Supply Chain Constraints"]
- **Q2 [Year]:** Key Theme: [e.g., "Pricing Actions taken"]
- **Q3 [Year]:** Key Theme: [e.g., "Demand Softening"]
- **Q4 [Year]:** Key Theme: [e.g., "Cost Cutting / Efficiency"]

### Guidance vs. Reality
- **The Audit:** [Compare a specific promise from 3 years ago to today's actual result.]
- **"Beat & Raise" Ratio:** Frequency of beating their own guidance in the last 12 quarters.

### Capital Allocation Priorities
- **Cash Use (Last 5 Years):** Capex [X]% | M&A [X]% | Buybacks/Divs [X]%
- **M&A Track Record:** Did past acquisitions improve or degrade ROIC?

---

## 6. Valuation Deep Dive

### Historical Multiples Analysis
- **Primary Band:** Current [X]x vs. 10-Year Range ([Low]x - [High]x).
- **Context:** Is the multiple low because earnings are cyclically peaking (Value Trap risk)?

### Reverse DCF (Expectations Investing)
- **Implied Growth:** What revenue growth/margin is the market pricing in at the current price?
- **Feasibility:** Is this implied hurdle low or high relative to history?

### Relative Valuation
- **Historical Valuations:** What is the historical average and median P/E ratio for the competitive set?
- **Current Valuations:** Show a table of this company and its 4 closest competitors

---

## 7. Technical Analysis & Timing (The "When")

### Trend & Momentum
- **Primary Trend:** [Bullish / Bearish] (Price vs. 200-Day SMA).
- **RSI (14):** [Value] ([Overbought/Neutral/Oversold]).

### Key Levels
- **Resistance (Target):** $[Price] (Recent Highs).
- **Support (Stop Loss):** $[Price] (Recent Lows / 50-Day SMA).

---

## 8. Risks & "Pre-Mortem"

- **The "Kill" Criteria:** If this investment fails, what is the single most likely reason?
- **Bear Case Scenario:** Modeled downside price ($[Price]) in a recession/execution failure.
- **"Colonel Blotto" Risk:** Is the company fighting too many battles on too many fronts?

---

## 9. Appendices

- **Glossary of Acronyms**
- **Sources:** (Links to specific sources used).
`

const ONE_PAGER_TEMPLATE = `# **Investment Snapshot: [Company Name] (Ticker)**

Analyst: Stratos Brain AI | Date: [Date] | Rec: [Long/Short] | Conviction: [High/Med/Low]

Price: $[X] | Target: $[X] | Upside: [X]% | Trend: [Bullish/Bearish]

---

### **1. THE EXECUTIVE THESIS**

* **The Hook:** [2 sentences. What is the core specific opportunity?]
* **Why Now? (Key Catalysts):**
  * [Catalyst 1: e.g., Upcoming Product Launch in Q3]
  * [Catalyst 2: e.g., Competitor regulatory stumbling block]
  * [Catalyst 3: e.g., Recent 15% pullback on non-fundamental news]
* **The Gap (Consensus vs. Reality):**
  * **Market Thinks:** [Summary of consensus fear/apathy]
  * **We Believe:** [Our contrarian view]

### **2. WHAT YOU NEED TO BELIEVE (The "Bull Case" Logic)**

*[Agent Instruction: List the 3 critical assumptions required for this stock to double. If these aren't true, the thesis breaks.]*

1. **[Assumption 1]:** (e.g., "Gross Margins must expand from 30% to 40% via automation.")
2. **[Assumption 2]:** (e.g., "Revenue growth accelerates to >15% in FY+1.")
3. **[Assumption 3]:** (e.g., "Management hits their $1B FCF target by 2025.")

---

### **3. FINANCIAL TRAJECTORY (LTM + 2-Year Forecast)**

*[Agent Instruction: Focus on the trend. Is growth accelerating or decelerating?]*

| Metric | LTM (Actual) | FY+1 (Est) | FY+2 (Est) | Trajectory |
| :---- | :---- | :---- | :---- | :---- |
| **Revenue ($B)** | $[X] | $[X] | $[X] | [Accel/Decel] |
| **YoY Growth** | [X]% | [X]% | [X]% |  |
| **EBITDA Margin** | [X]% | [X]% | [X]% | [Expanding/Contracting] |
| **EPS** | $[X] | $[X] | $[X] |  |
| **Free Cash Flow** | $[X] | $[X] | $[X] |  |

* **Valuation Reality:** Trading at **[X]x [P/E or Sales]** (vs. 5Y Avg: **[Y]x**).
* **Balance Sheet Check:** Cash: $[X]B | Debt: $[X]B | **Runway/Stability:** [Secure/Concern].

---

### **4. KEY RISKS (The "Pre-Mortem")**

* **The "Kill" Criteria:** [What single specific event destroys this thesis? e.g., "FDA Rejection"]
* **Bear Case Target:** $[Price] (Implies -[X]% downside).
* **Management "Say/Do" Check:** [Pass/Fail] – *[Briefly: Do they have a history of missing guidance?]*
`

// ==================== NEW: DEEP RESEARCH REPORT TEMPLATE ====================

const DEEP_RESEARCH_TEMPLATE = `# Deep Research Report: [Company Name] ([Ticker])

**Generated:** [Date] | **Analyst:** Stratos Brain AI | **Report Version:** 1.0

---

## Executive Summary

*[2-3 paragraph summary covering: 1) What the company does and how it makes money, 2) The 3-5 key metrics that matter for this business, 3) Current state and investment implications]*

---

## Part 1: Business Model Deep Dive

### 1.1 Company Overview

**What does this company actually do?**

*[Comprehensive description of the company's core business, history, founding story, and current market position. Include when founded, key milestones, and current scale.]*

### 1.2 Products & Services Breakdown

| Product/Service | Description | Revenue Contribution | Growth Rate | Margin Profile |
|-----------------|-------------|---------------------|-------------|----------------|
| [Product 1] | [What it does] | [X]% | [X]% | [High/Medium/Low] |
| [Product 2] | | | | |
| [Product 3] | | | | |

**Analysis:** *[Which products are growth drivers vs cash cows? Any products in decline?]*

### 1.3 Revenue Model Analysis

**How exactly does money flow into this business?**

| Revenue Stream | Type | % of Total | Recurring? | Visibility |
|----------------|------|------------|------------|------------|
| [Stream 1] | (Subscription/Transaction/License/Hardware/Services) | [X]% | Yes/No | High/Medium/Low |
| [Stream 2] | | | | |
| [Stream 3] | | | | |

**Revenue Quality Assessment:** *[Is this high-quality recurring revenue or lumpy one-time sales? What's the predictability?]*

### 1.4 Revenue Breakdown by Geography

| Region | Revenue ($M) | % of Total | YoY Growth | Key Trends |
|--------|-------------|------------|------------|------------|
| North America | | | | |
| Europe | | | | |
| Asia-Pacific | | | | |
| Latin America | | | | |
| Other | | | | |

**Geographic Risk Assessment:** *[Concentration risk? Currency exposure? Regulatory differences by region?]*

### 1.5 Revenue Breakdown by Channel

| Channel | Description | % of Revenue | Trend | Strategic Importance |
|---------|-------------|--------------|-------|---------------------|
| Direct Sales | | | | |
| Partner/Reseller | | | | |
| E-commerce/Self-serve | | | | |
| Enterprise | | | | |

### 1.6 Customer Analysis

**Who buys from this company and why?**

| Customer Segment | Description | % of Revenue | Avg Deal Size | Retention Rate | Growth |
|------------------|-------------|--------------|---------------|----------------|--------|
| [Segment 1] | | | | | |
| [Segment 2] | | | | | |
| [Segment 3] | | | | | |

**Customer Concentration:** 
- Top customer: [X]% of revenue
- Top 10 customers: [X]% of revenue
- **Risk Assessment:** *[Is there dangerous concentration?]*

**Value Proposition:** *[Why do customers choose this company over alternatives? What problem does it solve?]*

### 1.7 The Buying Process

**How do customers actually buy?**

- **Sales Cycle Length:** [X] months (typical range: [X-Y] months)
- **Decision Makers:** [Who signs the check? C-suite? Department head? End user?]
- **Procurement Process:** [RFP? Direct negotiation? Self-serve? Land-and-expand?]
- **Switching Costs:** [High/Medium/Low] — *[Explain: What makes it hard/easy to switch?]*
- **Implementation Time:** [X] weeks/months

### 1.8 Seasonality & Cyclicality

| Quarter | Typical Revenue Pattern | % of Annual | Explanation |
|---------|------------------------|-------------|-------------|
| Q1 | [Strong/Weak/Normal] | [X]% | [Why?] |
| Q2 | | | |
| Q3 | | | |
| Q4 | | | |

**Cyclical Sensitivity:** *[How does this business perform in recessions? Is it tied to GDP, housing, tech spending, etc.?]*

### 1.9 Margin Structure by Segment

| Segment | Gross Margin | Operating Margin | Key Cost Drivers |
|---------|--------------|------------------|------------------|
| [Segment 1] | [X]% | [X]% | [Main costs] |
| [Segment 2] | | | |
| [Segment 3] | | | |
| **Consolidated** | **[X]%** | **[X]%** | |

**Margin Trajectory:** *[Are margins expanding or contracting? What's driving the change?]*

### 1.10 Business Model Summary

**The Business Model in One Paragraph:**

*[Synthesize everything above: This company makes money by [X], selling primarily to [Y] customers, with [Z]% recurring revenue. The key economic drivers are [A, B, C]. Margins are [expanding/stable/contracting] because [reason].]*

### 1.11 Upcoming Catalysts (12-Month View)

**What events will move this stock in the next 12 months?**

| # | Catalyst | Expected Date | Impact | Bull Case | Bear Case |
|---|----------|---------------|--------|-----------|-----------|
| 1 | [Event: e.g., Q2 Earnings] | [Date] | High/Med/Low | [Positive scenario] | [Negative scenario] |
| 2 | [Event: e.g., Product Launch] | [Date] | | | |
| 3 | [Event: e.g., FDA Decision] | [Date] | | | |

**Catalyst Assessment:** *[Which catalyst has the highest probability of moving the stock? What's the risk/reward setup?]*

---

## Part 2: Historical Financial Analysis

### 2.1 Income Statement Trends (5 Years)

*[Agent Instruction: Extract actual historical data. Use Google Search to find investor presentations, 10-K filings, and financial databases.]*

| Metric ($M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | TTM |
|-------------|------|------|------|------|------|-----|
| Revenue | | | | | | |
| YoY Growth % | | | | | | |
| Gross Profit | | | | | | |
| Gross Margin % | | | | | | |
| EBITDA | | | | | | |
| EBITDA Margin % | | | | | | |
| EBIT | | | | | | |
| EBIT Margin % | | | | | | |
| Net Income | | | | | | |
| Net Margin % | | | | | | |
| Diluted EPS | | | | | | |

**Key Observations:**
1. **Revenue Growth:** *[Describe the trajectory - accelerating, decelerating, cyclical?]*
2. **Margin Story:** *[Are margins expanding? Why or why not?]*
3. **Inflection Points:** *[Any major changes? What caused them?]*

### 2.2 Cash Flow Analysis (5 Years)

| Metric ($M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | TTM |
|-------------|------|------|------|------|------|-----|
| Operating Cash Flow | | | | | | |
| Capital Expenditures | | | | | | |
| Free Cash Flow | | | | | | |
| FCF Margin % | | | | | | |
| FCF Conversion % | | | | | | |
| Dividends Paid | | | | | | |
| Share Buybacks | | | | | | |

**Cash Flow Quality Assessment:**
- Is FCF tracking net income? *[If not, why?]*
- Working capital trends: *[Cash tied up in inventory/receivables?]*
- CapEx intensity: *[Maintenance vs growth capex?]*

### 2.3 Balance Sheet Health

| Metric | Current | 3Y Avg | 5Y Avg | Industry Avg | Assessment |
|--------|---------|--------|--------|--------------|------------|
| Cash & Equivalents ($M) | | | | | |
| Total Debt ($M) | | | | | |
| Net Debt ($M) | | | | | |
| Debt/EBITDA | | | | | |
| Net Debt/EBITDA | | | | | |
| Interest Coverage | | | | | |
| Current Ratio | | | | | |
| Quick Ratio | | | | | |

**Financial Strength Grade:** [A/B/C/D/F]
*[Explanation: Why this grade? Any concerns?]*

### 2.4 Return on Capital Analysis

| Metric | Current | 3Y Avg | 5Y Avg | 10Y Avg | Industry Avg | Assessment |
|--------|---------|--------|--------|---------|--------------|------------|
| ROIC | | | | | | |
| ROE | | | | | | |
| ROA | | | | | | |
| ROCE | | | | | | |

**Capital Efficiency Assessment:**
- Is ROIC > WACC? *[Creating or destroying value?]*
- ROIC trend: *[Improving, stable, or declining?]*
- What drives returns? *[Margins? Asset turns? Leverage?]*

### 2.5 Revenue by Segment (Historical)

| Segment ($M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | TTM | 5Y CAGR |
|--------------|------|------|------|------|------|-----|---------|
| [Segment 1] | | | | | | | |
| [Segment 2] | | | | | | | |
| [Segment 3] | | | | | | | |
| **Total** | | | | | | | |

**Segment Mix Shift:** *[How is the business mix changing over time? Is this good or bad for margins/growth?]*

---

## Part 3: Key Metrics That Matter

### 3.1 Identifying the Right Metrics

*[Agent Instruction: Based on the business model analysis, identify 3-5 metrics that ACTUALLY MATTER for this specific business. Do NOT use generic metrics. The metrics must be specific to this company's business model.]*

**Why These Metrics?**

Based on the business model analysis above, these are the **3-5 metrics that actually matter** for evaluating [Company Name]:

| # | Metric | Why It Matters for THIS Business | Current Value | Historical Range | Target/Benchmark |
|---|--------|----------------------------------|---------------|------------------|------------------|
| 1 | [Metric 1] | [Specific explanation] | | | |
| 2 | [Metric 2] | [Specific explanation] | | | |
| 3 | [Metric 3] | [Specific explanation] | | | |
| 4 | [Metric 4] | [Specific explanation] | | | |
| 5 | [Metric 5] | [Specific explanation] | | | |

### 3.2 Key Metric #1: [Metric Name]

**Definition:** *[Exactly how is this calculated? Formula if applicable.]*

**Why It Matters for [Company Name]:** *[Specific explanation tied to the business model discovered in Part 1]*

**Historical Trend:**

| Period | Value | YoY Change | Commentary |
|--------|-------|------------|------------|
| FY-5 | | | |
| FY-4 | | | |
| FY-3 | | | |
| FY-2 | | | |
| FY-1 | | | |
| TTM/Latest | | | |

**Management Commentary:** *[What has management said about this metric in recent earnings calls? Include direct quotes if available.]*

**What to Watch:**
- **Bullish signal:** *[What would indicate improvement?]*
- **Bearish signal:** *[What would indicate deterioration?]*

### 3.3 Key Metric #2: [Metric Name]

*[Same detailed structure as 3.2]*

### 3.4 Key Metric #3: [Metric Name]

*[Same detailed structure as 3.2]*

### 3.5 Key Metric #4: [Metric Name]

*[Same detailed structure as 3.2]*

### 3.6 Key Metric #5: [Metric Name]

*[Same detailed structure as 3.2]*

### 3.7 Key Metrics Dashboard Summary

| Metric | Current | vs 1Y Ago | vs 3Y Ago | vs 5Y Ago | Trend | Signal |
|--------|---------|-----------|-----------|-----------|-------|--------|
| [Metric 1] | | | | | ↑/↓/→ | 🟢/🟡/🔴 |
| [Metric 2] | | | | | | |
| [Metric 3] | | | | | | |
| [Metric 4] | | | | | | |
| [Metric 5] | | | | | | |

**Overall Assessment:** *[Are the key metrics improving or deteriorating? What's the trajectory?]*

---

## Part 4: Competitive Position

### 4.1 Industry Overview

*[Brief overview: Industry size, growth rate, key trends, major players]*

- **Total Addressable Market (TAM):** $[X]B
- **Industry Growth Rate:** [X]% CAGR
- **Key Industry Trends:** *[3-5 major trends affecting the industry]*

### 4.2 Competitive Landscape

| Competitor | Revenue | Market Share | Key Strengths | Key Weaknesses | Threat Level |
|------------|---------|--------------|---------------|----------------|--------------|
| **[This Company]** | $[X]B | [X]% | | | — |
| [Competitor 1] | | | | | High/Med/Low |
| [Competitor 2] | | | | | |
| [Competitor 3] | | | | | |
| [Competitor 4] | | | | | |

### 4.3 Competitive Advantages (Moat Analysis)

| Moat Type | Present? | Strength (1-5) | Evidence |
|-----------|----------|----------------|----------|
| Network Effects | Yes/No | | |
| Switching Costs | Yes/No | | |
| Cost Advantages | Yes/No | | |
| Intangible Assets (Brand/IP) | Yes/No | | |
| Efficient Scale | Yes/No | | |

**Overall Moat Assessment:** [Wide/Narrow/None]
*[Explanation: What is the durable competitive advantage, if any?]*

### 4.4 Market Share Trends

| Year | [Company] Share | Main Competitor | Industry Trend |
|------|-----------------|-----------------|----------------|
| 5Y Ago | [X]% | [X]% | |
| 3Y Ago | | | |
| Current | | | |

**Share Trajectory:** *[Gaining or losing share? Why?]*

---

## Part 5: Management & Capital Allocation

### 5.1 Leadership Team

**CEO:** [Name] (Since [Year])
- **Background:** *[Brief bio - previous roles, education]*
- **Track Record:** *[Key accomplishments and failures at this company]*
- **Compensation:** *[How are they paid? Aligned with shareholders?]*
- **Ownership:** [X]% of shares outstanding

**CFO:** [Name] (Since [Year])
- **Background:** *[Brief bio]*
- **Track Record:** *[Key accomplishments]*

**Key Executives:** *[Any other critical leaders to note?]*

### 5.2 Capital Allocation History (5 Years)

| Use of Cash | 5Y Total ($M) | % of Total | Assessment |
|-------------|---------------|------------|------------|
| CapEx (Maintenance) | | | Good/Bad/Neutral |
| CapEx (Growth) | | | |
| M&A | | | |
| Dividends | | | |
| Buybacks | | | |
| Debt Paydown | | | |
| **Total Cash Deployed** | | 100% | |

**Capital Allocation Grade:** [A/B/C/D/F]
*[Explanation: Are they good stewards of capital?]*

### 5.3 M&A Track Record

| Acquisition | Year | Price Paid | Strategic Rationale | Outcome (Success/Failure) |
|-------------|------|------------|---------------------|---------------------------|
| [Deal 1] | | | | |
| [Deal 2] | | | | |
| [Deal 3] | | | | |

**M&A Assessment:** *[Good acquirer or value destroyer?]*

### 5.4 Guidance vs Reality ("Say/Do" Audit)

**Find one specific example where management missed or exceeded their own long-term guidance:**

| Timeframe | What Management Promised | What Actually Happened | Assessment |
|-----------|--------------------------|------------------------|------------|
| [Year/Period] | [Specific guidance given] | [Actual outcome] | [Met/Exceeded/Missed] |

**Example Analysis:** *[Describe the specific promise, the context, and what it reveals about management's forecasting ability and credibility.]*

**Management Credibility Assessment:** 
- **Track Record:** *[Based on this and other examples, do they tend to under-promise and over-deliver, or vice versa?]*
- **Communication Style:** *[Are they transparent about challenges? Do they provide realistic guidance?]*

---

## Part 6: Risks & Considerations

### 6.1 Key Risk Factors

| Risk | Probability | Impact | Mitigation | How to Monitor |
|------|-------------|--------|------------|----------------|
| [Risk 1] | H/M/L | H/M/L | [What company is doing] | [What to watch] |
| [Risk 2] | | | | |
| [Risk 3] | | | | |
| [Risk 4] | | | | |
| [Risk 5] | | | | |

### 6.2 Bear Case Scenario

**What would have to go wrong for this investment to fail?**

*[Detailed bear case: specific scenarios, quantified downside]*

### 6.3 Regulatory & ESG Considerations

- **Regulatory Risks:** *[Any pending regulation? Antitrust? Industry-specific?]*
- **ESG Concerns:** *[Environmental, social, governance issues?]*
- **Litigation:** *[Any material lawsuits?]*

---

## Part 7: Valuation Context

### 7.1 Current Valuation Multiples

| Metric | Current | 5Y Avg | 10Y Avg | Industry Avg | vs History |
|--------|---------|--------|---------|--------------|------------|
| P/E (TTM) | | | | | Premium/Discount |
| P/E (NTM) | | | | | |
| EV/EBITDA | | | | | |
| EV/Revenue | | | | | |
| P/FCF | | | | | |
| P/B | | | | | |

### 7.2 Valuation Assessment

**Is the stock cheap, fair, or expensive?**

*[Analysis: Compare to history, peers, and growth rate. What multiple is appropriate for this business?]*

---

## Part 8: Summary & Key Takeaways

### 8.1 Investment Thesis Recap (The Bull vs Bear Case)

**The Bull Case:** *[2-3 sentences: Why would this investment succeed? What are the key drivers of upside?]*

**The Bear Case:** *[2-3 sentences: Why would this investment fail? What are the key risks?]*

**Net Assessment:** *[1 sentence: Given the above, what is the risk/reward setup?]*

### 8.2 The Key Metrics That Matter

| # | Metric | Current | Assessment | Trend |
|---|--------|---------|------------|-------|
| 1 | [Metric 1] | [Value] | [Good/Neutral/Concerning] | ↑/↓/→ |
| 2 | [Metric 2] | | | |
| 3 | [Metric 3] | | | |
| 4 | [Metric 4] | | | |
| 5 | [Metric 5] | | | |

### 8.3 Key Questions for Further Research

*[List 3-5 specific questions that need more investigation]*

1. [Question 1]
2. [Question 2]
3. [Question 3]

### 8.4 Suggested Follow-Up Topics for Company Chat

Use the **Company Chat** feature to dive deeper into:
- Specific sections of 10-K/10-Q filings
- Management commentary from earnings calls
- Competitive dynamics and market share data
- Historical trends in any metric
- Risk factor analysis

---

## Appendix

### A. Data Sources

*[List all sources used: SEC filings, investor presentations, news articles, etc.]*

### B. Glossary

*[Define any industry-specific or company-specific terms]*

### C. Methodology Notes

*[Explain any calculations, assumptions, or data adjustments]*

---

*This Deep Research Report was generated by Stratos Brain AI using Gemini 3 Pro with Google Search grounding. All data should be verified against primary sources before making investment decisions. Use the Company Chat feature to ask follow-up questions about any section of this report.*
`

// ==================== SYSTEM PROMPTS ====================

const SYSTEM_PROMPT = `# ROLE & OBJECTIVE
You are the **Lead Equity Research Agent** for Stratos Brain. Your goal is to generate institutional-grade investment documents that are 100% compliant with a specific **Template**.

To do this, you must synthesize two distinct sources of truth:
1.  **Internal Database (Provided):** Hard financials, technical indicators, and proprietary AI scores.
2.  **External Reality (You must research this):** Real-time news, management sentiment, and macro risks which are NOT in the database.

# THE WORKFLOW (Strictly Follow This Sequence)

## PHASE 1: GAP ANALYSIS & RESEARCH
Before generating the document, you must analyze the provided DATABASE_DATA against the TEMPLATE.
* **Identify what is missing.** The database has numbers (PE, RSI, Revenue), but it likely lacks *qualitative* context (e.g., "Why did the CEO resign?", "What are the specific details of the new product launch?", "What is the tone of the latest earnings call?").
* **EXECUTE RESEARCH:** You **MUST utilize Google Search** to find high-quality, up-to-date sources to fill these specific gaps.
    * *Target:* Recent earnings transcripts, reputable financial news (Bloomberg, Reuters, CNBC), and competitor announcements.
    * *Focus:* Look for "Management Confidence," "Geopolitical Risks," and "Catalysts" that explain the numbers in the database.

## PHASE 2: SYNTHESIS & GENERATION
Once you have gathered the missing qualitative data, generate the full document.
* **Structure:** Follow the TEMPLATE structure **exactly**. Do not add or remove sections.
* **Data Integrity:**
    * If a metric exists in the DATABASE_DATA (e.g., pe_ratio, rsi_14, ai_score), you MUST use that exact number. **Do not hallucinate numbers.**
    * If the database says review_status: "missing", rely heavily on your own interpretation of the ohlcv and features data for the technical section.
* **Citations:** When you state a fact from your Phase 1 research (e.g., "The CEO announced a buyback..."), you must cite the source found via Google Search.

# STYLE GUIDELINES
* **Tone:** Professional, objective, institutional (Goldman Sachs/Morgan Stanley style).
* **Formatting:** Use clean Markdown. Use tables where the template requests them.
* **Opinion:** Be decisive. If the data suggests a "Bullish" trend, say so clearly, backed by the database evidence.
`

const DEEP_RESEARCH_SYSTEM_PROMPT = `# ROLE & OBJECTIVE

You are the **Lead Equity Research Analyst** for Stratos Brain, tasked with generating comprehensive Deep Research Reports. Your goal is to create institutional-grade research that answers two fundamental questions:

1. **How does this company make money?** (Business Model)
2. **What metrics actually matter for this specific business?** (Key Metrics)

This report will serve as the foundation for ongoing research conversations via the Company Chat interface.

# THE WORKFLOW

## PHASE 1: BUSINESS MODEL DEEP DIVE

Before generating any financials, you MUST deeply understand the business model:

1. **Products/Services:** What exactly does the company sell? How has the product mix evolved?
2. **Revenue Streams:** Subscription? Transaction? License? Hardware? Services? What's recurring vs one-time?
3. **Customer Base:** Who buys? Enterprise? SMB? Consumer? Government? What's the concentration?
4. **Geographic Mix:** Where does revenue come from? Any concentration risks?
5. **Channel Strategy:** Direct sales? Partners? E-commerce? How do customers actually buy?
6. **Seasonality:** Any quarterly patterns? Cyclical exposure to macro factors?
7. **Margin Structure:** What drives costs? How do margins vary by segment?

**RESEARCH REQUIRED:** Use Google Search extensively to find:
- Recent investor presentations and investor day materials
- 10-K business description sections (Item 1)
- Industry reports and market research
- Management interviews and conference presentations
- Competitor comparisons and market share data

## PHASE 2: FINANCIAL DATA EXTRACTION

Extract and present historical financials for 7-10 years where available:
- Income statement metrics (Revenue, Gross Profit, EBITDA, EBIT, Net Income)
- Cash flow metrics (OCF, CapEx, FCF)
- Balance sheet metrics (Cash, Debt, Working Capital)
- Return metrics (ROIC, ROE, ROA)
- Segment breakdowns by business line and geography

**CALCULATE:**
- YoY growth rates for all metrics
- Margins (Gross, EBITDA, EBIT, Net, FCF)
- CAGRs for key metrics over 3Y, 5Y, 10Y periods
- FCF conversion (FCF / Net Income)

## PHASE 3: KEY METRICS IDENTIFICATION

**THIS IS CRITICAL:** Based on the business model discovered in Phase 1, identify 3-5 metrics that ACTUALLY MATTER for THIS specific business.

**DO NOT use generic metrics.** The metrics must be SPECIFIC to this business model:
- For a SaaS company: ARR, Net Revenue Retention, CAC Payback, Rule of 40
- For a retailer: Same-store sales, Inventory turns, Sales per sq ft
- For a bank: NIM, Efficiency ratio, NPL ratio, CET1 ratio
- For a manufacturer: Capacity utilization, Book-to-bill, Backlog
- For a subscription business: Churn rate, ARPU, LTV/CAC

**For each key metric you identify:**
1. Define exactly how it's calculated
2. Explain why it matters for THIS specific business (tie back to the business model)
3. Show the historical trend (5+ years if available)
4. Include management commentary from recent earnings calls
5. Identify what would signal improvement vs deterioration

## PHASE 4: SYNTHESIS

Bring everything together:
- Executive summary that captures the essence of the business
- Competitive position and moat analysis
- Management quality assessment
- Risk factors specific to this business
- Valuation context (is it cheap/fair/expensive vs history and peers?)
- Key questions for follow-up research

# STYLE GUIDELINES

- **Tone:** Professional, objective, institutional (Goldman Sachs/Morgan Stanley quality)
- **Formatting:** Clean Markdown with extensive use of tables for financial data
- **Data:** Use exact numbers from sources. Cite everything with links.
- **Length:** Comprehensive (15-20 pages equivalent) but readable
- **Tables:** Use tables extensively - they make financial data scannable
- **Citations:** Include source links for all external data points

# CRITICAL RULES

1. **Business Model First:** Do NOT discuss financials until you understand HOW the company makes money
2. **Specific Metrics:** Do NOT use generic metrics. Every metric must be justified for THIS specific business
3. **Historical Context:** Show 7-10 years of data where available to identify trends
4. **Management Voice:** Include direct quotes from earnings calls where relevant
5. **No Hallucination:** If data is unavailable, say so explicitly. Do NOT make up numbers.
6. **Actionable:** End with specific questions for follow-up research via Company Chat
7. **Source Everything:** Every data point should have a source. Use Google Search extensively.

# OUTPUT FORMAT

Generate the complete report following the TEMPLATE structure exactly. Fill in every section with real data from your research. If a section cannot be completed due to lack of data, note what's missing and why.
`

// ==================== HELPER FUNCTIONS ====================

interface AssetData {
  asset: Record<string, unknown>
  as_of_date: string
  ohlcv: Array<Record<string, unknown>>
  features: Record<string, unknown>
  scores: Record<string, unknown>
  signals: Array<Record<string, unknown>>
  review: Record<string, unknown> | null
  review_status: string
  fundamentals?: Record<string, unknown>
  quarterly_fundamentals?: Array<Record<string, unknown>>
  annual_fundamentals?: Array<Record<string, unknown>>
}

function formatDatabaseContext(data: AssetData): string {
  const asset = data.asset || {}
  const review = data.review || {}
  const features = data.features || {}
  const ohlcv = data.ohlcv || []
  
  // Get recent OHLCV (last 30 days)
  const recentOhlcv = ohlcv.slice(-30)
  
  const context = {
    // Core info
    symbol: asset.symbol,
    company_name: asset.name,
    sector: asset.sector || asset.category,
    industry: asset.industry || asset.category,
    description: asset.short_description,
    
    // Valuation
    market_cap: asset.market_cap,
    pe_ratio: asset.pe_ratio,
    forward_pe: asset.forward_pe,
    price_to_sales_ttm: asset.price_to_sales_ttm,
    ev_to_ebitda: asset.ev_to_ebitda,
    price_to_book: asset.price_to_book,
    peg_ratio: asset.peg_ratio,
    
    // Growth & Profitability
    revenue_ttm: asset.revenue_ttm,
    revenue_growth_yoy: asset.revenue_growth_yoy,
    profit_margin: asset.profit_margin,
    operating_margin: asset.operating_margin,
    roe: asset.roe,
    roa: asset.roa,
    eps: asset.eps,
    earnings_growth_yoy: asset.earnings_growth_yoy,
    
    // Price context
    week_52_high: asset.week_52_high,
    week_52_low: asset.week_52_low,
    analyst_target_price: asset.analyst_target_price,
    beta: asset.beta,
    
    // AI Review data
    review_status: data.review_status,
    ai_direction_score: review.ai_direction_score,
    ai_setup_quality_score: review.ai_setup_quality_score,
    attention_level: review.attention_level,
    setup_type: review.setup_type,
    confidence: review.confidence,
    ai_summary: review.summary_text || review.ai_summary_text,
    entry: review.entry || review.ai_entry,
    targets: review.targets || review.ai_targets,
    invalidation: review.invalidation,
    support_levels: review.ai_key_levels?.support,
    resistance_levels: review.ai_key_levels?.resistance,
    risks: review.risks || review.ai_risks,
    why_now: review.why_now || review.ai_why_now,
    what_to_watch_next: review.what_to_watch_next,
    
    // Technical features (key ones)
    features: {
      rsi_14: features.rsi_14,
      sma_20: features.sma_20,
      sma_50: features.sma_50,
      sma_200: features.sma_200,
      macd_histogram: features.macd_histogram,
      atr_pct: features.atr_pct,
      trend_regime: features.trend_regime,
      return_1d: features.return_1d,
      return_5d: features.return_5d,
      return_21d: features.return_21d,
      return_63d: features.return_63d,
      return_252d: features.return_252d,
    },
    
    // Recent price action
    recent_ohlcv: recentOhlcv,
    as_of_date: data.as_of_date,
  }
  
  return JSON.stringify(context, null, 2)
}

function formatDeepResearchContext(data: AssetData): string {
  const asset = data.asset || {}
  const review = data.review || {}
  const features = data.features || {}
  const ohlcv = data.ohlcv || []
  const fundamentals = data.fundamentals || {}
  const quarterlyFundamentals = data.quarterly_fundamentals || []
  const annualFundamentals = data.annual_fundamentals || []
  
  // Get more OHLCV for deep research (last 252 trading days = ~1 year)
  const recentOhlcv = ohlcv.slice(-252)
  
  const context = {
    // Core info
    symbol: asset.symbol,
    company_name: asset.name,
    sector: asset.sector || asset.category,
    industry: asset.industry || asset.category,
    description: asset.short_description,
    asset_type: asset.asset_type,
    
    // Current Valuation Metrics
    valuation: {
      market_cap: asset.market_cap,
      enterprise_value: asset.enterprise_value,
      pe_ratio: asset.pe_ratio,
      forward_pe: asset.forward_pe,
      price_to_sales_ttm: asset.price_to_sales_ttm,
      ev_to_ebitda: asset.ev_to_ebitda,
      ev_to_revenue: asset.ev_to_revenue,
      price_to_book: asset.price_to_book,
      price_to_fcf: asset.price_to_fcf,
      peg_ratio: asset.peg_ratio,
    },
    
    // Current Fundamentals
    fundamentals: {
      revenue_ttm: asset.revenue_ttm || fundamentals.revenue_ttm,
      revenue_growth_yoy: asset.revenue_growth_yoy || fundamentals.revenue_growth_yoy,
      gross_margin: asset.gross_margin || fundamentals.gross_margin,
      operating_margin: asset.operating_margin || fundamentals.operating_margin,
      profit_margin: asset.profit_margin || fundamentals.profit_margin,
      ebitda: asset.ebitda || fundamentals.ebitda,
      ebitda_margin: fundamentals.ebitda_margin,
      free_cash_flow: asset.free_cash_flow || fundamentals.free_cash_flow,
      fcf_margin: fundamentals.fcf_margin,
      roe: asset.roe || fundamentals.roe,
      roa: asset.roa || fundamentals.roa,
      roic: fundamentals.roic,
      eps: asset.eps,
      eps_growth_yoy: asset.earnings_growth_yoy,
      dividend_yield: asset.dividend_yield,
      payout_ratio: fundamentals.payout_ratio,
    },
    
    // Balance Sheet
    balance_sheet: {
      total_cash: asset.total_cash || fundamentals.total_cash,
      total_debt: asset.total_debt || fundamentals.total_debt,
      net_debt: fundamentals.net_debt,
      debt_to_equity: fundamentals.debt_to_equity,
      current_ratio: fundamentals.current_ratio,
      quick_ratio: fundamentals.quick_ratio,
      book_value_per_share: fundamentals.book_value_per_share,
    },
    
    // Historical Quarterly Fundamentals (for trend analysis)
    quarterly_history: quarterlyFundamentals.slice(-20), // Last 5 years of quarters
    
    // Historical Annual Fundamentals (for long-term trends)
    annual_history: annualFundamentals.slice(-10), // Last 10 years
    
    // Price context
    price_data: {
      current_price: asset.current_price,
      week_52_high: asset.week_52_high,
      week_52_low: asset.week_52_low,
      analyst_target_price: asset.analyst_target_price,
      beta: asset.beta,
      avg_volume: asset.avg_volume,
    },
    
    // AI Review data (if available)
    ai_analysis: {
      review_status: data.review_status,
      direction_score: review.ai_direction_score,
      quality_score: review.ai_setup_quality_score,
      attention_level: review.attention_level,
      setup_type: review.setup_type,
      summary: review.summary_text || review.ai_summary_text,
    },
    
    // Technical features
    technical: {
      rsi_14: features.rsi_14,
      trend_regime: features.trend_regime,
      return_1d: features.return_1d,
      return_5d: features.return_5d,
      return_21d: features.return_21d,
      return_63d: features.return_63d,
      return_252d: features.return_252d,
    },
    
    // Recent price action (1 year)
    ohlcv_1y: recentOhlcv,
    as_of_date: data.as_of_date,
  }
  
  return JSON.stringify(context, null, 2)
}

async function callGeminiWithSearch(
  prompt: string,
  apiKey: string,
  systemPrompt: string = SYSTEM_PROMPT,
  maxTokens: number = 16384,
  useSearch: boolean = true // Enable/disable Google Search grounding
): Promise<{ text: string; sources: Array<{ title: string; uri: string }> }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`
  
  // Build request body - only include tools if useSearch is true
  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
    }
  }
  
  // Only add Google Search tool if useSearch is enabled
  if (useSearch) {
    requestBody.tools = [
      {
        googleSearch: {}
      }
    ]
  }
  
  console.log(`Calling Gemini API ${useSearch ? 'with' : 'without'} Google Search grounding...`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }
  
  const result = await response.json()
  
  // Extract text from response
  let text = ''
  const sources: Array<{ title: string; uri: string }> = []
  
  if (result.candidates && result.candidates.length > 0) {
    const candidate = result.candidates[0]
    
    // Extract text
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text
        }
      }
    }
    
    // Extract grounding sources (only if search was used)
    if (useSearch && candidate.groundingMetadata?.groundingChunks) {
      for (const chunk of candidate.groundingMetadata.groundingChunks) {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || 'Source',
            uri: chunk.web.uri || ''
          })
        }
      }
    }
  }
  
  return { text, sources }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q'
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const url = new URL(req.url)
    const path = url.pathname.replace('/generate-document', '')
    
    // POST / - Generate a document (ASYNC with job tracking)
    if (req.method === 'POST' && (path === '' || path === '/')) {
      const body = await req.json()
      const { symbol, asset_id, asset_type, document_type, user_id } = body
      
      if (!symbol) {
        return new Response(JSON.stringify({ error: 'Symbol is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Validate document type - now includes deep_research
      const validTypes = ['one_pager', 'memo', 'deep_research', 'all']
      const docType = validTypes.includes(document_type) ? document_type : 'one_pager'
      
      console.log(`Creating async job for ${docType} generation for ${symbol}...`)
      
      // Create job record immediately
      const { data: job, error: jobError } = await supabase
        .from('document_jobs')
        .insert({
          symbol,
          asset_id: asset_id || null,
          user_id: user_id || null,
          job_type: docType,
          status: 'pending',
          progress: 'Job created, starting generation...'
        })
        .select()
        .single()
      
      if (jobError) {
        console.error('Failed to create job:', jobError)
        return new Response(JSON.stringify({ error: 'Failed to create job', details: jobError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      console.log(`Job created: ${job.id}`)
      
      // Start background processing using EdgeRuntime.waitUntil
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil((async () => {
        try {
          // Update job to processing
          await supabase.from('document_jobs').update({ 
            status: 'processing',
            progress: 'Fetching asset data...'
          }).eq('id', job.id)
          
          console.log(`Starting background generation for job ${job.id}...`)
      // ==================== CASCADE GENERATION (document_type: 'all') ====================
      if (document_type === 'all') {
        console.log(`Starting Cascade Generation for ${symbol}...`)
        const startTime = Date.now()
        const results: { deep_research?: string; memo?: string; one_pager?: string } = {}
        
        // Fetch asset data first (shared across all documents)
        let assetDataUrl = `${supabaseUrl}/functions/v1/control-api/dashboard/asset?symbol=${symbol}`
        if (asset_type) {
          assetDataUrl += `&asset_type=${asset_type}`
        }
        
        const assetResponse = await fetch(assetDataUrl)
        if (!assetResponse.ok) {
          const errorText = await assetResponse.text()
          return new Response(JSON.stringify({ error: 'Failed to fetch asset data', details: errorText }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetData: AssetData = await assetResponse.json()
        const companyName = assetData.asset?.name || symbol
        const todayDate = new Date().toISOString().split('T')[0]
        
        // Fetch additional fundamental data for deep research
        if (asset_id) {
          try {
            const { data: quarterlyData } = await supabase
              .from('equity_quarterly_fundamentals')
              .select('*')
              .eq('asset_id', asset_id)
              .order('fiscal_date_ending', { ascending: false })
              .limit(20)
            
            if (quarterlyData) {
              assetData.quarterly_fundamentals = quarterlyData
            }
            
            const { data: annualData } = await supabase
              .from('equity_annual_fundamentals')
              .select('*')
              .eq('asset_id', asset_id)
              .order('fiscal_date_ending', { ascending: false })
              .limit(10)
            
            if (annualData) {
              assetData.annual_fundamentals = annualData
            }
            
            const { data: metadataData } = await supabase
              .from('equity_metadata')
              .select('*')
              .eq('asset_id', asset_id)
              .single()
            
            if (metadataData) {
              assetData.fundamentals = metadataData
            }
          } catch (err) {
            console.log('Note: Could not fetch additional fundamentals data:', err)
          }
        }
        
        // --- PHASE 1: THE SOURCE OF TRUTH (Deep Research) ---
        console.log('Phase 1: Generating Deep Research Report (with Google Search)...')
        const researchContext = formatDeepResearchContext(assetData)
        const researchPrompt = `
# TASK: Generate Deep Research Report for ${symbol} (${companyName})

## CONTEXT
You are creating a comprehensive Deep Research Report that will serve as the foundation for ongoing investment research. This report will be used with the Company Chat feature for follow-up questions.

## INPUT DATA

### Asset: ${symbol} (${companyName})
### Date: ${todayDate}
### Asset Type: ${asset_type || 'equity'}

### DATABASE DATA (Use as starting point, but research extensively beyond this):
\`\`\`json
${researchContext}
\`\`\`

### TEMPLATE (Follow this structure exactly):
\`\`\`markdown
${DEEP_RESEARCH_TEMPLATE}
\`\`\`

## CRITICAL INSTRUCTIONS

1. **BUSINESS MODEL FIRST**: Before writing ANY financials, deeply research and understand:
   - What products/services does ${companyName} sell?
   - How does revenue actually flow in? (Subscription? Transaction? License?)
   - Who are the customers? (Enterprise? SMB? Consumer?)
   - What's the geographic breakdown?
   - What drives margins?

2. **USE GOOGLE SEARCH EXTENSIVELY**: You MUST research:
   - Recent investor presentations
   - 10-K and 10-Q filings (especially Item 1 - Business Description)
   - Earnings call transcripts
   - Industry reports
   - Competitor analysis
   - Management interviews

3. **IDENTIFY BUSINESS-SPECIFIC METRICS**: Based on the business model you discover:
   - What 3-5 metrics ACTUALLY MATTER for THIS specific business?
   - Do NOT use generic metrics
   - Each metric must be justified based on the business model

4. **HISTORICAL DATA**: Show 5 years of financial history where available

5. **CITE EVERYTHING**: Every data point should have a source

6. **OUTPUT**: Return the complete Deep Research Report in clean Markdown format following the template exactly.
`
        
        const { text: deepResearchText, sources } = await callGeminiWithSearch(
          researchPrompt,
          geminiApiKey,
          DEEP_RESEARCH_SYSTEM_PROMPT,
          32768,
          true // useSearch = TRUE
        )
        
        if (!deepResearchText || deepResearchText.trim() === '') {
          return new Response(JSON.stringify({ error: 'Failed to generate Deep Research Report' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Save Deep Research Report
        const deepResearchFileName = `${symbol}_Deep_Research_Report_${todayDate}.md`
        const deepResearchPath = `deep_research/${asset_id || symbol}/${deepResearchFileName}`
        
        await supabase.storage.from('asset-files').upload(deepResearchPath, deepResearchText, {
          contentType: 'text/markdown',
          upsert: true
        })
        
        const { data: deepResearchUrl } = supabase.storage.from('asset-files').getPublicUrl(deepResearchPath)
        results.deep_research = deepResearchUrl.publicUrl
        
        if (asset_id) {
          await supabase.from('asset_files').delete().eq('asset_id', asset_id).eq('file_type', 'deep_research')
          await supabase.from('asset_files').insert({
            asset_id,
            file_name: deepResearchFileName,
            file_path: deepResearchUrl.publicUrl,
            file_type: 'deep_research',
            file_size: deepResearchText.length,
            description: `Generated by Gemini AI (${sources.length} sources cited)`
          })
        }
        
        console.log('Phase 1 complete. Deep Research Report saved.')
        await supabase.from('document_jobs').update({ 
          progress: 'Phase 1/3: Deep Research complete. Synthesizing Memo...'
        }).eq('id', job.id)
        
        // --- PHASE 2: THE SYNTHESIS (Memo) ---
        console.log('Phase 2: Synthesizing Investment Memo (no search)...')
        const memoPrompt = `
You are the Stratos Brain Investment Committee Secretary.

TASK: Convert the provided Deep Research Report into a standard Investment Memo.

CRITICAL RULES:
1. DO NOT SEARCH THE WEB. Use the Report below as your ONLY source of truth.
2. If the Report lacks data for a section, state "Not specified in Research Report".
3. Maintain the same "Bull/Bear" stance as the Report.
4. Use the exact financial figures from the Report - do not make up new numbers.
5. Follow the TEMPLATE structure exactly.

<SOURCE_REPORT>
${deepResearchText}
</SOURCE_REPORT>

<TEMPLATE>
${MEMO_TEMPLATE}
</TEMPLATE>

Generate the complete Investment Memo following the template structure. Use only information from the SOURCE_REPORT.
`
        
        const { text: memoText } = await callGeminiWithSearch(
          memoPrompt,
          geminiApiKey,
          "You are an expert financial synthesizer. Your job is to transform comprehensive research into concise investment documents. Use ONLY the provided source material - do not add external information.",
          16384,
          false // useSearch = FALSE
        )
        
        // Save Memo
        const memoFileName = `${symbol}_Investment_Memo_${todayDate}.md`
        const memoPath = `memos/${asset_id || symbol}/${memoFileName}`
        
        await supabase.storage.from('asset-files').upload(memoPath, memoText, {
          contentType: 'text/markdown',
          upsert: true
        })
        
        const { data: memoUrl } = supabase.storage.from('asset-files').getPublicUrl(memoPath)
        results.memo = memoUrl.publicUrl
        
        if (asset_id) {
          await supabase.from('asset_files').delete().eq('asset_id', asset_id).eq('file_type', 'memo')
          await supabase.from('asset_files').insert({
            asset_id,
            file_name: memoFileName,
            file_path: memoUrl.publicUrl,
            file_type: 'memo',
            file_size: memoText.length,
            description: 'Synthesized from Deep Research Report'
          })
        }
        
        console.log('Phase 2 complete. Investment Memo saved.')
        await supabase.from('document_jobs').update({ 
          progress: 'Phase 2/3: Memo complete. Synthesizing One Pager...'
        }).eq('id', job.id)
        
        // --- PHASE 3: THE SNAPSHOT (One Pager) ---
        console.log('Phase 3: Synthesizing One Pager (no search)...')
        const onePagerPrompt = `
You are the Stratos Brain Investment Committee Secretary.

TASK: Synthesize the provided Deep Research Report into a high-impact One Pager.

CRITICAL RULES:
1. DO NOT SEARCH THE WEB. Use the Report below as your ONLY source of truth.
2. Extract only the most critical information - this is a 1-page summary.
3. Maintain the same investment stance as the Report.
4. Use the exact financial figures from the Report.
5. Follow the TEMPLATE structure exactly.

<SOURCE_REPORT>
${deepResearchText}
</SOURCE_REPORT>

<TEMPLATE>
${ONE_PAGER_TEMPLATE}
</TEMPLATE>

Generate the complete One Pager following the template structure. Use only information from the SOURCE_REPORT.
`
        
        const { text: onePagerText } = await callGeminiWithSearch(
          onePagerPrompt,
          geminiApiKey,
          "You are an expert financial synthesizer. Your job is to distill comprehensive research into a single-page investment snapshot. Be concise but impactful. Use ONLY the provided source material.",
          8192,
          false // useSearch = FALSE
        )
        
        // Save One Pager
        const onePagerFileName = `${symbol}_One_Pager_${todayDate}.md`
        const onePagerPath = `one_pagers/${asset_id || symbol}/${onePagerFileName}`
        
        await supabase.storage.from('asset-files').upload(onePagerPath, onePagerText, {
          contentType: 'text/markdown',
          upsert: true
        })
        
        const { data: onePagerUrl } = supabase.storage.from('asset-files').getPublicUrl(onePagerPath)
        results.one_pager = onePagerUrl.publicUrl
        
        if (asset_id) {
          await supabase.from('asset_files').delete().eq('asset_id', asset_id).eq('file_type', 'one_pager')
          await supabase.from('asset_files').insert({
            asset_id,
            file_name: onePagerFileName,
            file_path: onePagerUrl.publicUrl,
            file_type: 'one_pager',
            file_size: onePagerText.length,
            description: 'Synthesized from Deep Research Report'
          })
        }
        
        console.log('Phase 3 complete. One Pager saved.')
        
        const totalTime = (Date.now() - startTime) / 1000
        console.log(`Cascade generation complete in ${totalTime}s`)
        
        // Update job as completed
        await supabase.from('document_jobs').update({
          status: 'completed',
          progress: 'All documents generated successfully',
          result: {
            files: results,
            generation_time_seconds: totalTime,
            sources_cited: sources.length
          },
          completed_at: new Date().toISOString()
        }).eq('id', job.id)
        
        console.log(`Job ${job.id} completed successfully`)
      }
      
      // ==================== SINGLE DOCUMENT GENERATION ====================
      else {
        // Update progress for single document
        await supabase.from('document_jobs').update({ 
          progress: `Generating ${docType}...`
        }).eq('id', job.id)
      
      // Step 1: Fetch asset data from control-api
      // Include asset_type if provided to disambiguate symbols like COMP (Compass equity vs Compound crypto)
      let assetDataUrl = `${supabaseUrl}/functions/v1/control-api/dashboard/asset?symbol=${symbol}`
      if (asset_type) {
        assetDataUrl += `&asset_type=${asset_type}`
      }
      console.log(`Fetching asset data from: ${assetDataUrl}`)
      
      const assetResponse = await fetch(assetDataUrl)
      if (!assetResponse.ok) {
        const errorText = await assetResponse.text()
        return new Response(JSON.stringify({ error: 'Failed to fetch asset data', details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const assetData: AssetData = await assetResponse.json()
      const companyName = assetData.asset?.name || symbol
      const todayDate = new Date().toISOString().split('T')[0]
      
      // For deep research, fetch additional fundamental data
      if (docType === 'deep_research' && asset_id) {
        try {
          // Fetch quarterly fundamentals
          const { data: quarterlyData } = await supabase
            .from('equity_quarterly_fundamentals')
            .select('*')
            .eq('asset_id', asset_id)
            .order('fiscal_date_ending', { ascending: false })
            .limit(20)
          
          if (quarterlyData) {
            assetData.quarterly_fundamentals = quarterlyData
          }
          
          // Fetch annual fundamentals
          const { data: annualData } = await supabase
            .from('equity_annual_fundamentals')
            .select('*')
            .eq('asset_id', asset_id)
            .order('fiscal_date_ending', { ascending: false })
            .limit(10)
          
          if (annualData) {
            assetData.annual_fundamentals = annualData
          }
          
          // Fetch equity metadata
          const { data: metadataData } = await supabase
            .from('equity_metadata')
            .select('*')
            .eq('asset_id', asset_id)
            .single()
          
          if (metadataData) {
            assetData.fundamentals = metadataData
          }
        } catch (err) {
          console.log('Note: Could not fetch additional fundamentals data:', err)
        }
      }
      
      // Step 2: Prepare the prompt based on document type
      let databaseContext: string
      let template: string
      let systemPrompt: string
      let maxTokens: number
      
      if (docType === 'deep_research') {
        databaseContext = formatDeepResearchContext(assetData)
        template = DEEP_RESEARCH_TEMPLATE
        systemPrompt = DEEP_RESEARCH_SYSTEM_PROMPT
        maxTokens = 32768 // Larger output for comprehensive report
      } else {
        databaseContext = formatDatabaseContext(assetData)
        template = docType === 'memo' ? MEMO_TEMPLATE : ONE_PAGER_TEMPLATE
        systemPrompt = SYSTEM_PROMPT
        maxTokens = 16384
      }
      
      const prompt = docType === 'deep_research' 
        ? `
# TASK: Generate Deep Research Report for ${symbol} (${companyName})

## CONTEXT
You are creating a comprehensive Deep Research Report that will serve as the foundation for ongoing investment research. This report will be used with the Company Chat feature for follow-up questions.

## INPUT DATA

### Asset: ${symbol} (${companyName})
### Date: ${todayDate}
### Asset Type: ${asset_type || 'equity'}

### DATABASE DATA (Use as starting point, but research extensively beyond this):
\`\`\`json
${databaseContext}
\`\`\`

### TEMPLATE (Follow this structure exactly):
\`\`\`markdown
${template}
\`\`\`

## CRITICAL INSTRUCTIONS

1. **BUSINESS MODEL FIRST**: Before writing ANY financials, deeply research and understand:
   - What products/services does ${companyName} sell?
   - How does revenue actually flow in? (Subscription? Transaction? License?)
   - Who are the customers? (Enterprise? SMB? Consumer?)
   - What's the geographic breakdown?
   - What drives margins?

2. **USE GOOGLE SEARCH EXTENSIVELY**: You MUST research:
   - Recent investor presentations
   - 10-K and 10-Q filings (especially Item 1 - Business Description)
   - Earnings call transcripts
   - Industry reports
   - Competitor analysis
   - Management interviews

3. **IDENTIFY BUSINESS-SPECIFIC METRICS**: Based on the business model you discover:
   - What 3-5 metrics ACTUALLY MATTER for THIS specific business?
   - Do NOT use generic metrics
   - Each metric must be justified based on the business model

4. **HISTORICAL DATA**: Show 7-10 years of financial history where available

5. **CITE EVERYTHING**: Every data point should have a source

6. **OUTPUT**: Return the complete Deep Research Report in clean Markdown format following the template exactly.
`
        : `
# TASK: Generate Investment ${docType === 'memo' ? 'Memo' : 'One Pager'} for ${symbol}

## INPUT DATA

### Asset: ${symbol} (${companyName})
### Date: ${todayDate}

### DATABASE DATA (Use these exact numbers where applicable):
\`\`\`json
${databaseContext}
\`\`\`

### TEMPLATE (Follow this structure exactly):
\`\`\`markdown
${template}
\`\`\`

## INSTRUCTIONS

1. **First**, analyze the DATABASE DATA above. Note what quantitative data is available.

2. **Second**, use Google Search to research the following for ${symbol}:
   - Latest news and developments (last 2-4 weeks)
   - Recent earnings call highlights or guidance
   - Management commentary and strategic updates
   - Competitive landscape changes
   - Analyst ratings and price target changes
   - Any regulatory or macro risks

3. **Third**, generate the complete ${docType === 'memo' ? 'memo' : 'one pager'} following the TEMPLATE structure exactly:
   - Fill in all database-driven sections with the exact numbers from DATABASE DATA
   - Fill in all research-driven sections with findings from your Google Search
   - Cite all external sources with links
   - Be decisive in your investment stance based on the combined evidence

4. **Output**: Return ONLY the completed document in clean Markdown format.
`
      
      // Step 3: Call Gemini with Google Search
      console.log(`Calling Gemini API for ${docType}...`)
      const startTime = Date.now()
      
      const { text: documentContent, sources } = await callGeminiWithSearch(
        prompt, 
        geminiApiKey, 
        systemPrompt,
        maxTokens
      )
      
      const generationTime = (Date.now() - startTime) / 1000
      console.log(`Document generated in ${generationTime}s with ${sources.length} sources`)
      
      if (!documentContent || documentContent.trim() === '') {
        return new Response(JSON.stringify({ error: 'Gemini returned empty response' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Step 4: Save to Supabase Storage
      let fileName: string
      let storagePath: string
      
      if (docType === 'deep_research') {
        fileName = `${symbol}_Deep_Research_Report_${todayDate}.md`
        storagePath = `deep_research/${asset_id || symbol}/${fileName}`
      } else if (docType === 'memo') {
        fileName = `${symbol}_Investment_Memo_${todayDate}.md`
        storagePath = `memos/${asset_id || symbol}/${fileName}`
      } else {
        fileName = `${symbol}_One_Pager_${todayDate}.md`
        storagePath = `one_pagers/${asset_id || symbol}/${fileName}`
      }
      
      const { error: uploadError } = await supabase.storage
        .from('asset-files')
        .upload(storagePath, documentContent, {
          contentType: 'text/markdown',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return new Response(JSON.stringify({ error: 'Failed to upload to storage', details: uploadError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('asset-files')
        .getPublicUrl(storagePath)
      
      console.log(`File uploaded to: ${urlData.publicUrl}`)
      
      // Step 5: Save record to asset_files table
      if (asset_id) {
        // Delete any existing placeholder entries
        await supabase
          .from('asset_files')
          .delete()
          .eq('asset_id', asset_id)
          .eq('file_type', docType)
          .like('description', '%Generating%')
        
        // Insert new record
        const { error: insertError } = await supabase
          .from('asset_files')
          .insert({
            asset_id,
            file_name: fileName,
            file_path: urlData.publicUrl,
            file_type: docType,
            file_size: documentContent.length,
            description: `Generated by Gemini AI (${sources.length} sources cited)`
          })
        
        if (insertError) {
          console.error('Database insert error:', insertError)
          // Don't fail the request, file is already uploaded
        }
      }
      
      // Update job as completed
        await supabase.from('document_jobs').update({
          status: 'completed',
          progress: 'Document generated successfully',
          result: {
            document_type: docType,
            file_name: fileName,
            file_url: urlData.publicUrl,
            storage_path: storagePath,
            generation_time_seconds: generationTime,
            sources_cited: sources.length,
            content_length: documentContent.length
          },
          completed_at: new Date().toISOString()
        }).eq('id', job.id)
        
        console.log(`Job ${job.id} completed successfully`)
      } // end single document else block
      
        } catch (bgError) {
          // Background job failed
          console.error(`Job ${job.id} failed:`, bgError)
          await supabase.from('document_jobs').update({
            status: 'failed',
            error: bgError.message || 'Unknown error during generation',
            completed_at: new Date().toISOString()
          }).eq('id', job.id)
        }
      })()) // End EdgeRuntime.waitUntil
      
      // Return job ID immediately (202 Accepted)
      return new Response(JSON.stringify({
        success: true,
        message: 'Document generation started',
        job_id: job.id,
        job_type: docType
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // GET /status - Health check
    if (req.method === 'GET' && path === '/status') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'generate-document',
        model: 'gemini-3-pro-preview',
        features: ['google_search_grounding', 'memo', 'one_pager', 'deep_research']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

