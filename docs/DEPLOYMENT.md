# Deployment Guide

This guide covers deploying the Stratos Signal Engine to production.

## Architecture Overview

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

## Prerequisites

### Supabase Setup

1. **Enable Extensions** in Supabase Dashboard → Database → Extensions:
   - `pgmq` - Message queue
   - `pg_cron` - Job scheduling (optional, for automated runs)

2. **Run Migrations**:
   ```bash
   ./scripts/run-migrations.sh
   ```

3. **Deploy Edge Function**:
   ```bash
   supabase functions deploy control-api
   ```

### GCP Setup

1. **Create Project** (if needed):
   ```bash
   gcloud projects create stratos-brain
   gcloud config set project stratos-brain
   ```

2. **Enable APIs**:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

3. **Create Secrets**:
   ```bash
   echo -n "your-supabase-url" | gcloud secrets create stratos-supabase-url --data-file=-
   echo -n "your-service-key" | gcloud secrets create stratos-supabase-key --data-file=-
   echo -n "your-db-host" | gcloud secrets create stratos-db-host --data-file=-
   echo -n "your-db-password" | gcloud secrets create stratos-db-password --data-file=-
   echo -n "your-openai-key" | gcloud secrets create stratos-openai-key --data-file=-
   ```

## Deployment

### Option 1: GCP Cloud Run (Recommended)

```bash
# Set environment variables
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1

# Deploy
./scripts/deploy-gcp.sh
```

### Option 2: Docker (Self-hosted)

```bash
# Build image
docker build -t stratos-engine -f docker/Dockerfile .

# Run
docker run --env-file .env stratos-engine
```

### Option 3: Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run worker
python -m stratos_engine.worker
```

## Scheduling

### Using pg_cron (Supabase)

Enable pg_cron in Supabase, then run:

```sql
-- Daily equity pipeline at 6:30 AM ET (11:30 UTC)
SELECT cron.schedule(
    'daily-signal-pipeline',
    '30 11 * * 1-5',
    $$SELECT enqueue_engine_job('full_pipeline', CURRENT_DATE, 'equities_all')$$
);

-- Daily crypto pipeline at 12:00 UTC
SELECT cron.schedule(
    'daily-crypto-pipeline',
    '0 12 * * *',
    $$SELECT enqueue_engine_job('full_pipeline', CURRENT_DATE, 'crypto_all')$$
);
```

### Using GCP Cloud Scheduler

```bash
gcloud scheduler jobs create http daily-signal-pipeline \
    --schedule="30 11 * * 1-5" \
    --uri="https://your-region-your-project.cloudfunctions.net/enqueue" \
    --http-method=POST \
    --message-body='{"job_type":"full_pipeline","universe_id":"equities_all"}'
```

## Monitoring

### View Logs

```bash
# GCP Cloud Run
gcloud run services logs read stratos-engine-worker --region us-central1

# Docker
docker logs -f stratos-engine
```

### Check Queue Depth

```sql
SELECT get_queue_depth();
```

### View Recent Runs

```sql
SELECT * FROM v_recent_runs;
```

## Troubleshooting

### Worker Not Processing Jobs

1. Check queue has messages:
   ```sql
   SELECT COUNT(*) FROM pgmq.q_signal_engine_jobs WHERE vt <= NOW();
   ```

2. Check worker logs for errors

3. Verify database connectivity

### Signals Not Generating

1. Check features exist for date:
   ```sql
   SELECT COUNT(*) FROM daily_features WHERE date = CURRENT_DATE;
   ```

2. Run pipeline manually:
   ```bash
   python scripts/run-pipeline.py --date 2025-01-01 --log-level DEBUG
   ```

### AI Stage Failing

1. Check OpenAI API key is set
2. Verify budget hasn't been exhausted
3. Check for rate limiting in logs
