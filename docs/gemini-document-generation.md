# Gemini-Based Document Generation

This document describes the migration from Manus AI to Gemini for generating investment memos and one-pagers in Stratos Brain.

## Overview

The new system uses **Gemini 3 Pro Preview** with **Google Search grounding** to generate institutional-grade investment documents. This provides several advantages over the previous Manus-based approach:

| Feature | Manus (Old) | Gemini (New) |
|---------|-------------|--------------|
| Generation Type | Asynchronous (polling required) | Synchronous (immediate response) |
| Web Research | Built-in | Google Search grounding |
| Model | Manus proprietary | Gemini 3 Pro Preview |
| Latency | 3-10 minutes | 1-2 minutes |
| Cost | Per-task | Per-search-query |
| Citations | Manual | Automatic with source links |

## Architecture

### Before (Manus)
```
Dashboard → POST /create-document → Manus API (async task)
         → Poll /memo-status/:task_id every 10s
         → Download file when complete
         → Save to Supabase Storage
```

### After (Gemini)
```
Dashboard → POST /generate-document → Fetch asset data
                                    → Call Gemini with Google Search
                                    → Save to Supabase Storage
                                    → Return file URL immediately
```

## New Edge Function: `generate-document`

### Endpoint
```
POST https://wfogbaipiqootjrsprde.supabase.co/functions/v1/generate-document
```

### Request Body
```json
{
  "symbol": "AAPL",
  "asset_id": 123,
  "document_type": "memo"  // or "one_pager"
}
```

### Response
```json
{
  "success": true,
  "document_type": "memo",
  "file_name": "AAPL_Investment_Memo_2026-01-08.md",
  "file_url": "https://..../asset-files/memos/123/AAPL_Investment_Memo_2026-01-08.md",
  "storage_path": "memos/123/AAPL_Investment_Memo_2026-01-08.md",
  "generation_time_seconds": 45.2,
  "sources_cited": 24,
  "content_length": 15234
}
```

### Health Check
```
GET https://wfogbaipiqootjrsprde.supabase.co/functions/v1/generate-document/status
```

## Environment Variables

The edge function requires:

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google AI API key | Hardcoded fallback |
| `SUPABASE_URL` | Supabase project URL | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Auto-injected |

## Deployment

### 1. Deploy the Edge Function

```bash
cd supabase/functions/generate-document
supabase functions deploy generate-document --project-ref wfogbaipiqootjrsprde
```

### 2. Set Environment Variables

```bash
supabase secrets set GEMINI_API_KEY=AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q --project-ref wfogbaipiqootjrsprde
```

### 3. Update Frontend Component

Replace the import in your asset summary page:

```tsx
// Old
import { DocumentsSection } from '@/components/DocumentsSection';

// New
import { DocumentsSection } from '@/components/DocumentsSectionGemini';
```

Or rename `DocumentsSectionGemini.tsx` to `DocumentsSection.tsx` after backing up the original.

## Templates

The system uses two templates embedded in the edge function:

### Memo Template
A comprehensive 9-section investment memo including:
- Executive Summary
- Business Overview & Segment Analysis
- Financial Snapshot
- Strategic Quality & Moat Analysis
- Management & Governance
- Valuation Deep Dive
- Technical Analysis
- Risks & Pre-Mortem
- Appendices

### One Pager Template
A concise 4-section snapshot including:
- Executive Thesis
- Bull Case Logic
- Financial Trajectory
- Key Risks

## How It Works

1. **Fetch Asset Data**: The function calls the existing `/dashboard/asset` endpoint to get all database data (fundamentals, technicals, AI scores, OHLCV history).

2. **Prepare Context**: The data is formatted into a structured JSON context that Gemini can understand.

3. **Call Gemini with Search**: The prompt includes:
   - System instructions for the "Lead Equity Research Agent" role
   - The database context
   - The template to follow
   - Instructions to use Google Search for qualitative research

4. **Extract Response**: The function extracts the generated text and any grounding sources.

5. **Save to Storage**: The markdown file is uploaded to Supabase Storage.

6. **Update Database**: A record is created in the `asset_files` table.

## Billing Considerations

Gemini 3 bills per search query executed, not per prompt. Each document generation typically uses 6-10 search queries, depending on the complexity of the asset and how much qualitative research is needed.

## Rollback Plan

If issues arise, you can revert to the Manus-based system by:

1. Restoring the original `DocumentsSection.tsx` component
2. The old `/dashboard/create-document` endpoint still exists in `control-api`

## Testing

Test the new endpoint:

```bash
curl -X POST https://wfogbaipiqootjrsprde.supabase.co/functions/v1/generate-document \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "document_type": "one_pager"}'
```

## Future Improvements

1. **Streaming**: Implement streaming responses to show generation progress
2. **Caching**: Cache recent web research to reduce search costs
3. **Templates**: Allow custom templates per user/organization
4. **PDF Export**: Add option to generate PDF output
