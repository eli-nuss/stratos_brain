# Stratos Brain - Signal Engine

A production-grade trading signal detection engine built on Supabase with a Python worker for compute.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        STRATOS BRAIN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  Dashboard  │───▶│ Edge Func   │───▶│    Supabase DB      │ │
│  │   (React)   │    │ Control API │    │                     │ │
│  └─────────────┘    └─────────────┘    │  • assets           │ │
│                                        │  • daily_features   │ │
│  ┌─────────────┐    ┌─────────────┐    │  • daily_signal_    │ │
│  │  pg_cron    │───▶│   pgmq      │    │    facts            │ │
│  │ (scheduler) │    │  (queue)    │    │  • signal_instances │ │
│  └─────────────┘    └──────┬──────┘    │  • engine_configs   │ │
│                            │           │  • engine_jobs      │ │
│                            ▼           └─────────────────────┘ │
│                     ┌─────────────┐              ▲              │
│                     │   Python    │──────────────┘              │
│                     │   Worker    │                             │
│                     │ (GCP/Docker)│                             │
│                     └─────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.11+
- Supabase project with pg_cron and pgmq enabled
- Docker (for deployment)

### Local Development

```bash
# Clone and setup
git clone https://github.com/yourusername/stratos-brain.git
cd stratos-brain
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env  # Edit with your Supabase credentials

# Run worker
python -m stratos_engine.worker
```

### Docker Deployment

```bash
docker build -t stratos-engine -f docker/Dockerfile .
docker run --env-file .env stratos-engine
```

## Project Structure

```
stratos-brain/
├── src/stratos_engine/     # Python worker package
├── supabase/migrations/    # Database migrations
├── supabase/functions/     # Edge Functions
├── docker/                 # Docker configuration
├── scripts/                # Utility scripts
└── tests/                  # Test suite
```

## Signal Templates (v3.2)

| Template | Description |
|----------|-------------|
| momentum_inflection | Acceleration turning after deceleration |
| breakout_participation | Price breakout with volume confirmation |
| trend_ignition | New trend from consolidation |
| squeeze_release | Volatility squeeze releasing |
| rs_breakout | Relative strength breakout |
| volatility_shock | Unusual price movement |
| exhaustion | Momentum exhaustion at extremes |
| trend_breakdown | Trend failure/breakdown |
| trend_leadership | Strong uptrend attention |

## License

MIT
