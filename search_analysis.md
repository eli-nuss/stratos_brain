# Stratos Brain Search Implementation Analysis

## Current State: Multiple Fragmented Search Implementations

After analyzing the codebase, I've identified **8+ different search implementations** that work inconsistently:

### 1. CommandBar (`/components/CommandBar.tsx`)
- **Purpose**: Global search modal triggered by ⌘K
- **Searches**: Assets only (tickers, company names)
- **Features**: Quick actions, keyboard navigation
- **API**: `/api/dashboard/all-assets?search=...&limit=8`
- **Limitations**: No industry/sector search, no custom lists, limited results

### 2. AssetSearchDropdown (`/components/AssetSearchDropdown.tsx`)
- **Purpose**: Add assets to lists/portfolios
- **Searches**: Crypto + Equity universes separately
- **Features**: Debounced search, shows price/market cap
- **API**: Two parallel calls to `/api/dashboard/all-assets` with different `universe_id`
- **Limitations**: Only for adding to lists, not navigation

### 3. AssetSearchForChat (`/components/AssetSearchForChat.tsx`)
- **Purpose**: Select asset for Company Chat
- **Searches**: Same as AssetSearchDropdown
- **Features**: Similar to AssetSearchDropdown
- **Limitations**: Duplicate code, chat-specific

### 4. AllAssetsTable Search (`/components/AllAssetsTable.tsx`)
- **Purpose**: Filter table by symbol
- **Searches**: Symbol only (server-side)
- **Features**: Industry dropdown filter (separate from search)
- **API**: `/api/dashboard/all-assets?search=...&industry=...`
- **Limitations**: Separate from main search, table-specific

### 5. CompanyChatList Search (`/components/CompanyChatList.tsx`)
- **Purpose**: Filter existing chat sessions
- **Searches**: Chat display names (client-side)
- **Features**: Simple text filter
- **Limitations**: Only searches existing chats, not assets

### 6. ListSidebar Search (`/components/ListSidebar.tsx`)
- **Purpose**: Search ticker in sidebar
- **Searches**: Unknown (passed as prop)
- **Features**: Basic input
- **Limitations**: Unclear integration

### 7. MobileNav Search (`/components/MobileNav.tsx`)
- **Purpose**: Mobile search modal
- **Searches**: Assets (passed as prop)
- **Features**: Full-screen modal
- **Limitations**: Duplicates desktop functionality

### 8. Portfolio/Holdings Search (Multiple files)
- **Files**: `CorePortfolioHoldings.tsx`, `ModelPortfolioHoldings.tsx`, `PortfolioSandbox.tsx`
- **Purpose**: Add assets to portfolios
- **Searches**: Crypto + Equity universes
- **Features**: Inline search with results
- **Limitations**: Duplicated code across 3+ components

### 9. CustomizableStockListTable Filter (`/components/CustomizableStockListTable.tsx`)
- **Purpose**: Filter assets within a list
- **Searches**: Symbol/name (client-side)
- **Features**: Tag filtering
- **Limitations**: Only filters current list

## Data Available for Search

Based on the database schema and API:

| Data Type | Available | Currently Searchable |
|-----------|-----------|---------------------|
| Ticker/Symbol | ✅ | ✅ (in most searches) |
| Company Name | ✅ | ✅ (in most searches) |
| Industry | ✅ | ❌ (only as filter) |
| Sector | ✅ | ❌ (only as filter) |
| Category (crypto) | ✅ | ❌ (only as filter) |
| Custom Lists | ✅ | ❌ |
| Watchlist | ✅ | ❌ |
| Chat Sessions | ✅ | ✅ (separate search) |
| Research Notes | ✅ | ❌ |

## API Endpoint Analysis

The main search endpoint is `/api/dashboard/all-assets`:

```
GET /api/dashboard/all-assets
  ?search=<query>          # Symbol/name search (ILIKE)
  &asset_type=<equity|crypto>
  &universe_id=<id>
  &industry=<name>         # Exact match filter
  &min_market_cap=<num>
  &max_market_cap=<num>
  &limit=<num>
  &offset=<num>
```

The search is currently limited to:
- Symbol matching (ILIKE)
- Name matching (ILIKE)
- No full-text search
- No fuzzy matching
- No industry/sector search

## Key Issues

1. **Code Duplication**: Same search logic repeated in 5+ components
2. **Inconsistent UX**: Different search behaviors across the app
3. **Limited Scope**: Can't search industries, sectors, lists, or notes
4. **No Unified Entry Point**: Users must know where to search
5. **No Recent/Favorites**: No quick access to frequently used items
6. **No Search Categories**: Can't filter by type (stocks vs crypto vs lists)

## Recommendations for Unified Search

### Option A: Enhanced CommandBar (Recommended)
Extend the existing CommandBar to be a true "omnibox":

1. **Multi-category results**:
   - Assets (tickers, names)
   - Industries/Sectors (navigate to filtered view)
   - Custom Lists (navigate to list)
   - Recent Items (last viewed assets)
   - Quick Actions (existing)

2. **Smart categorization**:
   - Show results grouped by type
   - Allow filtering by category
   - Keyboard shortcuts for categories

3. **Backend changes**:
   - New unified search endpoint
   - Full-text search support
   - Industry/sector search

### Option B: Spotlight-style Search
Create a new comprehensive search component:

1. **Features**:
   - Full-screen overlay
   - Category tabs
   - Recent searches
   - Suggested queries

2. **Requires**:
   - New component from scratch
   - More significant UI changes

## Implementation Priority

1. Create unified search hook (`useUnifiedSearch`)
2. Extend CommandBar with categories
3. Add industry/sector search to backend
4. Add custom lists to search results
5. Add recent items tracking
6. Replace inline searches with unified component
