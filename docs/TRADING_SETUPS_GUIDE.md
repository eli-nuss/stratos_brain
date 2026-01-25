# Stratos Brain: Position Trading Setups Guide

**Generated:** January 25, 2026  
**Backtest Period:** January 2020 - December 2025 (6 years)  
**Universe:** 96 Blue-Chip US Equities

---

## Introduction

This guide provides a detailed explanation of each position trading setup tested in the Stratos Brain backtesting system. Each setup is designed for **1-12 month holding periods** and uses a consistent exit strategy:

- **Trailing Stop Loss**: Locks in gains as the trade moves in your favor.
- **50% Profit Target**: Captures significant winners.
- **Technical Breakdown**: Exits if the long-term trend deteriorates (close below 200 SMA).

---

## The Setups (Ranked by Reliability)

### 1. Trend Pullback to 50 MA (BEST SETUP)

| Metric | Value |
|--------|-------|
| **Win Rate** | 68.6% |
| **Profit Factor** | 14.14 |
| **Average Return** | +22.09% |
| **Average Hold** | 46 days |

**What it looks like:**
A stock in a strong, established uptrend (trading above its 200-day moving average) pulls back to its 50-day moving average, which often acts as a dynamic support level.

**How to use it:**
This is your bread-and-butter setup. When you see a high-quality stock you like pull back to its 50 MA, this is a high-probability entry point to join the existing uptrend. The exceptional profit factor means the winners are, on average, 14 times larger than the losers.

**Example:**
Imagine Apple (AAPL) has been in a strong uptrend for months. It then drifts down from $220 to $205, where it finds support right at its 50-day moving average. This is a classic entry point for this setup.

---

### 2. Oversold Quality (Mean Reversion)

| Metric | Value |
|--------|-------|
| **Win Rate** | 60.5% |
| **Profit Factor** | 6.34 |
| **Average Return** | +5.76% |
| **Average Hold** | 8 days |

**What it looks like:**
A quality stock gets beaten down in the short term, becoming technically "oversold" (e.g., low RSI, far below its 20-day moving average). This is not a broken stock, just one that has pulled back too far, too fast.

**How to use it:**
This is a short-term, tactical setup. When a stock you like has a sharp, unjustified drop, this setup allows you to enter for a quick bounce. The 8-day average hold shows that these trades are typically quick flips, not long-term holds. The trailing stop is key here to lock in the bounce.

**Example:**
NVIDIA (NVDA) drops 15% in a week due to general market weakness, not company-specific news. Its RSI is below 30. This setup would trigger an entry, looking for a quick 5-10% bounce as the selling pressure subsides.

---

### 3. Gap Up & Hold

| Metric | Value |
|--------|-------|
| **Win Rate** | 56.4% |
| **Profit Factor** | 5.32 |
| **Average Return** | +8.06% |
| **Average Hold** | 44 days |

**What it looks like:**
A stock opens significantly higher than its previous day's close (a "gap up"), usually on the back of positive news like strong earnings. Crucially, the stock does not sell off during the day; it holds or extends its gains, showing strong institutional buying.

**How to use it:**
This is a momentum setup. A gap up on high volume that holds is a powerful signal of institutional interest. You can use this setup to jump on board a new, powerful uptrend right as it begins.

**Example:**
Microsoft (MSFT) reports blowout earnings and gaps up 8% at the open. Throughout the day, it continues to trade strongly near its highs. This setup would trigger an entry, betting that this new momentum will continue.

---

### 4. Breakout from Consolidation

| Metric | Value |
|--------|-------|
| **Win Rate** | 58.6% |
| **Profit Factor** | 2.05 |
| **Average Return** | +2.83% |
| **Average Hold** | 80 days |

**What it looks like:**
A stock has been trading sideways in a tight range for a period of time (consolidating). It then breaks out above the top of that range on increased volume, signaling a potential new uptrend.

**How to use it:**
This is a classic momentum strategy. The consolidation period represents a balance between buyers and sellers. The breakout signals that the buyers have won, and the stock is likely to move higher. The longer hold period (80 days) suggests these trades take time to play out.

**Example:**
Coca-Cola (KO) has been trading between $58 and $62 for three months. It then breaks out above $62 on high volume. This setup would trigger an entry, betting on a sustained move higher.

---

### 5. Squeeze Release

| Metric | Value |
|--------|-------|
| **Win Rate** | 55.2% |
| **Profit Factor** | 1.99 |
| **Average Return** | +2.97% |
| **Average Hold** | 87 days |

**What it looks like:**
A stock's volatility has been contracting for a period of time (a "squeeze"). It then suddenly expands, with the price moving sharply in one direction. This setup looks for upward releases from these squeezes.

**How to use it:**
This is another momentum setup. The squeeze represents a coiling of energy. The release is the unleashing of that energy. This setup aims to capture the subsequent move. Like the breakout, this is a longer-term hold.

**Example:**
Procter & Gamble (PG) has been trading in an unusually tight range for several weeks, with its Bollinger Bands narrowing. It then has a large green candle that closes outside the bands, signaling a volatility expansion. This setup would trigger an entry.

---

## New Setup Ideas

Based on the success of the current setups, here are some new ideas we could test:

1.  **Earnings Gap Fill:**
    *   **Concept:** A stock gaps *down* on earnings, but then finds support and starts to fill the gap.
    *   **Rationale:** This can be a powerful reversal signal, as the initial negative reaction was overblown.

2.  **Inside Day Breakout:**
    *   **Concept:** A stock has an "inside day" (the entire daily range is within the previous day's range), and then breaks out above the high of the inside day.
    *   **Rationale:** The inside day represents a pause or indecision. The breakout provides a clear direction.

3.  **"Holy Grail" Setup (as described by Linda Raschke):**
    *   **Concept:** A stock in a strong uptrend pulls back to its 20-day exponential moving average (EMA), which has been trending higher for some time.
    *   **Rationale:** This is a variation of the `trend_pullback_50ma` but uses a shorter-term EMA, potentially providing more frequent signals.

4.  **Relative Strength Breakout:**
    *   **Concept:** A stock breaks out to a new 52-week high *relative to the S&P 500*.
    *   **Rationale:** This identifies true market leaders that are outperforming the overall market, not just rising with the tide.

---

## Next Steps: Optimization

Now that we have a clear understanding of the setups, the next step is to **optimize the parameters** for the best performers. For example, with the `trend_pullback_50ma` setup, we can test:

-   What if we enter when the price is within 1% of the 50 MA, instead of 3%?
-   What if we require the RSI to be below 40, instead of 50?
-   What if we use a 25% initial stop loss instead of 15%?

This process, known as **grid search**, will allow us to fine-tune the setups and potentially improve their performance even further.
