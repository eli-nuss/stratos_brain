# Control API Reference

The Control API is a Supabase Edge Function that provides REST endpoints for managing the signal engine.

## Base URL

```
https://<your-project>.supabase.co/functions/v1/control-api
```

## Authentication

All endpoints require a valid Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### GET /status

Get current engine status and summary statistics.

**Response:**
```json
{
  "as_of_date": "2025-01-15",
  "active_instances": 127,
  "new_today": 23,
  "bullish_count": 89,
  "bearish_count": 38,
  "by_template": {
    "trend_leadership": 45,
    "momentum_inflection": 23,
    "trend_breakdown": 31,
    ...
  },
  "last_run_status": "success",
  "last_run_at": "2025-01-15T11:30:00Z",
  "queue_depth": 0
}
```

### POST /enqueue

Enqueue a new pipeline job.

**Request Body:**
```json
{
  "job_type": "full_pipeline",
  "as_of_date": "2025-01-15",
  "universe_id": "equities_all",
  "config_id": "uuid-optional",
  "params": {}
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /configs

List all engine configurations.

**Response:**
```json
[
  {
    "config_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "default",
    "description": "Default configuration",
    "universe_id": "equities_all",
    "template_overrides": {},
    "min_strength_for_ai": 60,
    "ai_budget_per_run": 50,
    "enable_ai_stage": true,
    "is_active": true
  }
]
```

### PUT /configs/:id

Update a configuration.

**Request Body:**
```json
{
  "min_strength_for_ai": 70,
  "ai_budget_per_run": 100
}
```

### GET /runs

Get recent pipeline runs.

**Query Parameters:**
- `limit` (optional): Number of runs to return (default: 20)

**Response:**
```json
[
  {
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "as_of_date": "2025-01-15",
    "status": "success",
    "started_at": "2025-01-15T11:30:00Z",
    "ended_at": "2025-01-15T11:32:45Z",
    "duration_seconds": 165,
    "counts_json": {
      "stage1": {"assets_evaluated": 8000, "signals_generated": 450},
      "stage3": {"new_created": 23, "updated": 89, "ended": 12}
    },
    "config_name": "default"
  }
]
```

### GET /leaders

Get bullish leaders (top positive attention scores).

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)

**Response:**
```json
[
  {
    "symbol": "NVDA",
    "asset_name": "NVIDIA Corporation",
    "attention_score": 45.5,
    "trend_regime": "strong_uptrend",
    "active_signals": ["trend_leadership", "breakout_participation"],
    "signal_count": 2,
    "max_strength": 86,
    "return_1d": 0.023,
    "return_5d": 0.089
  }
]
```

### GET /risks

Get bearish risks (top negative attention scores).

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)

### GET /signals

Get active signal instances.

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `direction` (optional): Filter by direction (`bullish` or `bearish`)
- `template` (optional): Filter by template name

**Response:**
```json
[
  {
    "instance_id": "550e8400-e29b-41d4-a716-446655440000",
    "symbol": "AAPL",
    "template_name": "momentum_inflection",
    "direction": "bullish",
    "state": "active",
    "first_date": "2025-01-10",
    "current_strength": 72,
    "attention_score": 25.5,
    "attention_level": "focus",
    "confidence": 0.78,
    "thesis": "Strong momentum inflection with volume confirmation..."
  }
]
```

### GET /queue-depth

Get current queue depth.

**Response:**
```json
{
  "depth": 0
}
```

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not found
- `500` - Internal server error
