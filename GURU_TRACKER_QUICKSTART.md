# Guru Tracker - Quick Start Guide

**TL;DR:** Track super-investor portfolios in 3 steps

---

## 🚀 Quick Deployment (5 minutes)

### 1. Run Database Migration
```bash
cd /path/to/stratos_brain
supabase db push
```

### 2. Deploy Edge Function
```bash
# Set FMP API key
supabase secrets set FMP_API_KEY=your_fmp_key_here

# Deploy function
supabase functions deploy guru-api --project-ref wfogbaipiqootjrsprde --no-verify-jwt
```

### 3. Deploy Frontend
```bash
cd dashboard
pnpm build
vercel --prod
# OR just push to main branch for auto-deploy
```

---

## ✅ Quick Test

**Test the API:**
```bash
curl "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/guru-api/search?query=buffett" \
  -H "x-stratos-key: stratos_brain_api_key_2024"
```

**Test the UI:**
1. Navigate to `/gurus` in your dashboard
2. Click "Add Guru"
3. Search for "Berkshire Hathaway"
4. Click the result to track
5. View holdings sorted by conviction

---

## 📊 What You Get

**Features:**
- ✅ Search institutional investors by name
- ✅ Track unlimited gurus
- ✅ View holdings sorted by % portfolio (conviction)
- ✅ See position changes (NEW, ADD, REDUCE, SOLD)
- ✅ Refresh holdings to get latest 13F data
- ✅ Beautiful UI with conviction metrics

**Data Source:**
- Financial Modeling Prep (FMP) API
- 13F filings (quarterly updates)
- Covers all institutional investors managing >$100M

---

## 🎯 Popular Investors to Track

Try searching for these famous investors:

| Name | Fund | Known For |
|------|------|-----------|
| Warren Buffett | Berkshire Hathaway | Value investing legend |
| Michael Burry | Scion Asset Management | "The Big Short" |
| Bill Ackman | Pershing Square | Activist investor |
| Carl Icahn | Icahn Enterprises | Corporate raider |
| David Tepper | Appaloosa Management | Distressed debt |
| Ray Dalio | Bridgewater Associates | Macro hedge fund |
| Seth Klarman | Baupost Group | Value investing |
| Stanley Druckenmiller | Duquesne Family Office | Macro trader |

---

## 🔧 Troubleshooting

**"FMP_API_KEY not configured"**
→ Run: `supabase secrets set FMP_API_KEY=your_key`

**"No holdings found"**
→ Try a different investor (some funds don't file 13Fs)

**Search returns nothing**
→ Check your FMP API key is valid

---

## 📚 Full Documentation

For detailed deployment steps, API reference, and troubleshooting:
→ See `GURU_TRACKER_DEPLOYMENT.md`

For codebase architecture and FMP API details:
→ See `/home/ubuntu/stratos_brain_review.md`

---

## 🎉 You're Done!

Navigate to `/gurus` in your dashboard and start tracking super-investors!
