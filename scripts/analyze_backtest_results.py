"""
Backtest Results Analysis and Visualization

This script provides tools to:
1. Analyze backtest results from the database
2. Generate performance reports and visualizations
3. Compare setups and identify the best performers
4. Track parameter optimization over time

Usage:
    python scripts/analyze_backtest_results.py --universe crypto_top_100

Author: Manus AI
Date: January 25, 2026
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import structlog

from stratos_engine.db import Database

logger = structlog.get_logger()

# Set style for plots
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")


class BacktestAnalyzer:
    """Analyzes and visualizes backtest results."""

    def __init__(self):
        self.db = Database()
        self.output_dir = Path("/home/ubuntu/stratos_brain/reports")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # =========================================================================
    # DATA LOADING
    # =========================================================================

    def load_latest_rankings(self, universe: str) -> Optional[Dict]:
        """Load the most recent rankings for a universe."""
        query = """
        SELECT 
            ranking_date,
            asset_universe,
            rankings,
            best_setup,
            best_reliability_score,
            avg_reliability_score,
            analysis_start_date,
            analysis_end_date
        FROM setup_performance_rankings
        WHERE asset_universe = %s
        ORDER BY ranking_date DESC
        LIMIT 1
        """
        result = self.db.fetch_one(query, (universe,))
        return dict(result) if result else None

    def load_optimal_params(self, universe: str) -> List[Dict]:
        """Load current optimal parameters for all setups."""
        query = """
        SELECT 
            setup_name,
            optimal_params,
            win_rate,
            profit_factor,
            sharpe_ratio,
            reliability_score,
            total_trades,
            optimization_date
        FROM setup_optimal_params
        WHERE asset_universe = %s AND is_current = TRUE
        ORDER BY reliability_score DESC
        """
        results = self.db.fetch_all(query, (universe,))
        return [dict(r) for r in results]

    def load_all_backtest_runs(self, universe: str, setup_name: Optional[str] = None) -> pd.DataFrame:
        """Load all backtest runs with their metrics."""
        query = """
        SELECT 
            br.run_id,
            br.setup_name,
            br.parameters,
            br.run_at,
            bsm.total_trades,
            bsm.win_rate,
            bsm.profit_factor,
            bsm.sharpe_ratio,
            bsm.sortino_ratio,
            bsm.max_drawdown,
            bsm.avg_return_pct,
            bsm.reliability_score
        FROM backtest_runs br
        JOIN backtest_summary_metrics bsm ON br.run_id = bsm.run_id
        WHERE br.asset_universe = %s
        """
        params = [universe]
        
        if setup_name:
            query += " AND br.setup_name = %s"
            params.append(setup_name)
        
        query += " ORDER BY br.run_at DESC"
        
        results = self.db.fetch_all(query, tuple(params))
        return pd.DataFrame([dict(r) for r in results])

    def load_trade_distribution(self, universe: str, setup_name: str) -> pd.DataFrame:
        """Load trade return distribution for a specific setup."""
        query = """
        SELECT 
            bt.return_pct,
            bt.holding_period,
            bt.exit_reason,
            bt.is_winner,
            bt.entry_date
        FROM backtest_trades bt
        JOIN backtest_runs br ON bt.run_id = br.run_id
        JOIN setup_optimal_params sop ON br.run_id = sop.backtest_run_id
        WHERE br.asset_universe = %s 
          AND br.setup_name = %s
          AND sop.is_current = TRUE
        """
        results = self.db.fetch_all(query, (universe, setup_name))
        return pd.DataFrame([dict(r) for r in results])

    # =========================================================================
    # ANALYSIS FUNCTIONS
    # =========================================================================

    def calculate_setup_comparison(self, universe: str) -> pd.DataFrame:
        """Create a comparison table of all setups."""
        optimal_params = self.load_optimal_params(universe)
        
        if not optimal_params:
            return pd.DataFrame()
        
        df = pd.DataFrame(optimal_params)
        
        # Add rank
        df['rank'] = range(1, len(df) + 1)
        
        # Reorder columns
        columns = [
            'rank', 'setup_name', 'reliability_score', 'win_rate', 
            'profit_factor', 'sharpe_ratio', 'total_trades', 'optimization_date'
        ]
        df = df[[c for c in columns if c in df.columns]]
        
        return df

    def analyze_parameter_sensitivity(self, universe: str, setup_name: str) -> Dict:
        """Analyze how parameters affect performance for a setup."""
        df = self.load_all_backtest_runs(universe, setup_name)
        
        if df.empty:
            return {}
        
        # Extract parameters from JSON
        param_df = pd.json_normalize(df['parameters'])
        combined = pd.concat([df, param_df], axis=1)
        
        # Calculate correlation with reliability score
        numeric_cols = param_df.select_dtypes(include=[np.number]).columns
        correlations = {}
        
        for col in numeric_cols:
            if combined[col].nunique() > 1:
                corr = combined[col].corr(combined['reliability_score'])
                correlations[col] = corr
        
        # Find best and worst parameter combinations
        best_idx = combined['reliability_score'].idxmax()
        worst_idx = combined['reliability_score'].idxmin()
        
        return {
            'parameter_correlations': correlations,
            'best_params': combined.loc[best_idx, 'parameters'] if pd.notna(best_idx) else {},
            'worst_params': combined.loc[worst_idx, 'parameters'] if pd.notna(worst_idx) else {},
            'best_score': combined.loc[best_idx, 'reliability_score'] if pd.notna(best_idx) else 0,
            'worst_score': combined.loc[worst_idx, 'reliability_score'] if pd.notna(worst_idx) else 0,
        }

    # =========================================================================
    # VISUALIZATION FUNCTIONS
    # =========================================================================

    def plot_setup_comparison(self, universe: str, save: bool = True) -> plt.Figure:
        """Create a bar chart comparing all setups."""
        df = self.calculate_setup_comparison(universe)
        
        if df.empty:
            logger.warning("No data for comparison plot")
            return None
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f'Setup Performance Comparison - {universe}', fontsize=14, fontweight='bold')
        
        # Reliability Score
        ax1 = axes[0, 0]
        colors = plt.cm.RdYlGn(df['reliability_score'] / 100)
        bars = ax1.barh(df['setup_name'], df['reliability_score'], color=colors)
        ax1.set_xlabel('Reliability Score')
        ax1.set_title('Reliability Score (0-100)')
        ax1.axvline(x=60, color='green', linestyle='--', alpha=0.5, label='Target (60)')
        ax1.legend()
        
        # Win Rate
        ax2 = axes[0, 1]
        colors = plt.cm.RdYlGn(df['win_rate'])
        ax2.barh(df['setup_name'], df['win_rate'] * 100, color=colors)
        ax2.set_xlabel('Win Rate (%)')
        ax2.set_title('Win Rate')
        ax2.axvline(x=55, color='green', linestyle='--', alpha=0.5, label='Target (55%)')
        ax2.legend()
        
        # Profit Factor
        ax3 = axes[1, 0]
        colors = plt.cm.RdYlGn(np.clip(df['profit_factor'] / 3, 0, 1))
        ax3.barh(df['setup_name'], df['profit_factor'], color=colors)
        ax3.set_xlabel('Profit Factor')
        ax3.set_title('Profit Factor')
        ax3.axvline(x=1.5, color='green', linestyle='--', alpha=0.5, label='Target (1.5)')
        ax3.legend()
        
        # Sharpe Ratio
        ax4 = axes[1, 1]
        colors = plt.cm.RdYlGn(np.clip(df['sharpe_ratio'] / 2, 0, 1))
        ax4.barh(df['setup_name'], df['sharpe_ratio'], color=colors)
        ax4.set_xlabel('Sharpe Ratio')
        ax4.set_title('Sharpe Ratio (Annualized)')
        ax4.axvline(x=1.0, color='green', linestyle='--', alpha=0.5, label='Target (1.0)')
        ax4.legend()
        
        plt.tight_layout()
        
        if save:
            filepath = self.output_dir / f'setup_comparison_{universe}.png'
            plt.savefig(filepath, dpi=150, bbox_inches='tight')
            logger.info("Saved comparison plot", path=str(filepath))
        
        return fig

    def plot_return_distribution(self, universe: str, setup_name: str, save: bool = True) -> plt.Figure:
        """Plot the return distribution for a specific setup."""
        df = self.load_trade_distribution(universe, setup_name)
        
        if df.empty:
            logger.warning("No trade data for distribution plot")
            return None
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        fig.suptitle(f'Trade Analysis - {setup_name}', fontsize=14, fontweight='bold')
        
        # Return distribution
        ax1 = axes[0, 0]
        returns = df['return_pct'].dropna() * 100
        ax1.hist(returns, bins=50, edgecolor='black', alpha=0.7)
        ax1.axvline(x=0, color='red', linestyle='--', linewidth=2)
        ax1.axvline(x=returns.mean(), color='green', linestyle='-', linewidth=2, label=f'Mean: {returns.mean():.2f}%')
        ax1.set_xlabel('Return (%)')
        ax1.set_ylabel('Frequency')
        ax1.set_title('Return Distribution')
        ax1.legend()
        
        # Win/Loss by exit reason
        ax2 = axes[0, 1]
        exit_counts = df.groupby(['exit_reason', 'is_winner']).size().unstack(fill_value=0)
        exit_counts.plot(kind='bar', ax=ax2, color=['red', 'green'])
        ax2.set_xlabel('Exit Reason')
        ax2.set_ylabel('Count')
        ax2.set_title('Wins/Losses by Exit Reason')
        ax2.legend(['Loss', 'Win'])
        ax2.tick_params(axis='x', rotation=45)
        
        # Holding period distribution
        ax3 = axes[1, 0]
        holding = df['holding_period'].dropna()
        ax3.hist(holding, bins=20, edgecolor='black', alpha=0.7)
        ax3.axvline(x=holding.mean(), color='green', linestyle='-', linewidth=2, label=f'Mean: {holding.mean():.1f} days')
        ax3.set_xlabel('Holding Period (days)')
        ax3.set_ylabel('Frequency')
        ax3.set_title('Holding Period Distribution')
        ax3.legend()
        
        # Cumulative returns over time
        ax4 = axes[1, 1]
        if 'entry_date' in df.columns:
            df_sorted = df.sort_values('entry_date')
            cumulative = (1 + df_sorted['return_pct'].fillna(0)).cumprod()
            ax4.plot(range(len(cumulative)), cumulative, linewidth=2)
            ax4.axhline(y=1, color='gray', linestyle='--', alpha=0.5)
            ax4.set_xlabel('Trade Number')
            ax4.set_ylabel('Cumulative Return')
            ax4.set_title('Equity Curve')
        
        plt.tight_layout()
        
        if save:
            filepath = self.output_dir / f'trade_analysis_{setup_name}_{universe}.png'
            plt.savefig(filepath, dpi=150, bbox_inches='tight')
            logger.info("Saved trade analysis plot", path=str(filepath))
        
        return fig

    def plot_parameter_heatmap(self, universe: str, setup_name: str, save: bool = True) -> plt.Figure:
        """Create a heatmap showing parameter impact on performance."""
        df = self.load_all_backtest_runs(universe, setup_name)
        
        if df.empty or len(df) < 5:
            logger.warning("Insufficient data for heatmap")
            return None
        
        # Extract parameters
        param_df = pd.json_normalize(df['parameters'])
        numeric_cols = param_df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) < 2:
            logger.warning("Not enough numeric parameters for heatmap")
            return None
        
        # Take first two parameters for 2D heatmap
        param1, param2 = numeric_cols[0], numeric_cols[1]
        
        combined = pd.concat([df[['reliability_score']], param_df[[param1, param2]]], axis=1)
        pivot = combined.pivot_table(
            values='reliability_score',
            index=param1,
            columns=param2,
            aggfunc='mean'
        )
        
        fig, ax = plt.subplots(figsize=(10, 8))
        sns.heatmap(pivot, annot=True, fmt='.1f', cmap='RdYlGn', ax=ax)
        ax.set_title(f'Parameter Impact on Reliability Score\n{setup_name}')
        ax.set_xlabel(param2)
        ax.set_ylabel(param1)
        
        plt.tight_layout()
        
        if save:
            filepath = self.output_dir / f'param_heatmap_{setup_name}_{universe}.png'
            plt.savefig(filepath, dpi=150, bbox_inches='tight')
            logger.info("Saved parameter heatmap", path=str(filepath))
        
        return fig

    # =========================================================================
    # REPORT GENERATION
    # =========================================================================

    def generate_full_report(self, universe: str) -> str:
        """Generate a comprehensive markdown report."""
        report_lines = []
        
        # Header
        report_lines.append(f"# Backtest Analysis Report")
        report_lines.append(f"\n**Universe:** {universe}")
        report_lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("\n---\n")
        
        # Setup Comparison
        report_lines.append("## Setup Performance Comparison\n")
        comparison_df = self.calculate_setup_comparison(universe)
        
        if not comparison_df.empty:
            # Format for display
            display_df = comparison_df.copy()
            display_df['win_rate'] = display_df['win_rate'].apply(lambda x: f"{x*100:.1f}%")
            display_df['profit_factor'] = display_df['profit_factor'].apply(lambda x: f"{x:.2f}")
            display_df['sharpe_ratio'] = display_df['sharpe_ratio'].apply(lambda x: f"{x:.2f}")
            display_df['reliability_score'] = display_df['reliability_score'].apply(lambda x: f"{x:.1f}")
            
            report_lines.append(display_df.to_markdown(index=False))
        else:
            report_lines.append("*No backtest data available.*")
        
        report_lines.append("\n---\n")
        
        # Optimal Parameters
        report_lines.append("## Optimal Parameters by Setup\n")
        optimal_params = self.load_optimal_params(universe)
        
        for params in optimal_params:
            report_lines.append(f"### {params['setup_name']}\n")
            report_lines.append(f"**Reliability Score:** {params['reliability_score']:.1f}/100\n")
            report_lines.append(f"**Win Rate:** {params['win_rate']*100:.1f}%\n")
            report_lines.append(f"**Profit Factor:** {params['profit_factor']:.2f}\n")
            report_lines.append(f"**Total Trades:** {params['total_trades']}\n")
            report_lines.append("\n**Parameters:**\n")
            report_lines.append("```json")
            report_lines.append(json.dumps(params['optimal_params'], indent=2))
            report_lines.append("```\n")
        
        report_lines.append("\n---\n")
        
        # Recommendations
        report_lines.append("## Recommendations\n")
        
        if comparison_df.empty:
            report_lines.append("*Run backtests to generate recommendations.*")
        else:
            # Top performers
            top_setups = comparison_df[comparison_df['reliability_score'].apply(lambda x: float(x.replace('/100', '')) if isinstance(x, str) else x) >= 60]
            if len(top_setups) > 0:
                report_lines.append(f"### ✅ High-Confidence Setups\n")
                for _, row in top_setups.iterrows():
                    report_lines.append(f"- **{row['setup_name']}**: Reliability {row['reliability_score']}, Win Rate {row['win_rate']}")
                report_lines.append("\n")
            
            # Low sample size warnings
            low_sample = comparison_df[comparison_df['total_trades'] < 30]
            if len(low_sample) > 0:
                report_lines.append(f"### ⚠️ Low Sample Size (< 30 trades)\n")
                for _, row in low_sample.iterrows():
                    report_lines.append(f"- {row['setup_name']}: {row['total_trades']} trades")
                report_lines.append("\n")
        
        # Save report
        report_content = "\n".join(report_lines)
        report_path = self.output_dir / f"backtest_report_{universe}_{datetime.now().strftime('%Y%m%d')}.md"
        
        with open(report_path, 'w') as f:
            f.write(report_content)
        
        logger.info("Generated report", path=str(report_path))
        return report_content

    def run_full_analysis(self, universe: str):
        """Run complete analysis with all visualizations and report."""
        logger.info("Starting full analysis", universe=universe)
        
        # Generate comparison plot
        self.plot_setup_comparison(universe)
        
        # Generate per-setup analysis
        optimal_params = self.load_optimal_params(universe)
        for params in optimal_params:
            setup_name = params['setup_name']
            self.plot_return_distribution(universe, setup_name)
            self.plot_parameter_heatmap(universe, setup_name)
        
        # Generate report
        report = self.generate_full_report(universe)
        
        print("\n" + "=" * 60)
        print("ANALYSIS COMPLETE")
        print("=" * 60)
        print(f"Reports saved to: {self.output_dir}")
        print("=" * 60)
        
        return report


def main():
    parser = argparse.ArgumentParser(description="Analyze backtest results")
    parser.add_argument(
        "--universe", default="crypto_top_100",
        help="Asset universe to analyze"
    )
    parser.add_argument(
        "--setup", default=None,
        help="Specific setup to analyze (optional)"
    )
    parser.add_argument(
        "--report-only", action="store_true",
        help="Generate report without plots"
    )

    args = parser.parse_args()

    analyzer = BacktestAnalyzer()
    
    if args.report_only:
        analyzer.generate_full_report(args.universe)
    else:
        analyzer.run_full_analysis(args.universe)


if __name__ == "__main__":
    main()
