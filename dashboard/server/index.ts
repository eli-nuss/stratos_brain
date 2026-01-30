import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_URL = "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api";
const GURU_API_URL = "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/investor-api";
const STRATOS_API_KEY = process.env.STRATOS_BRAIN_API_KEY || "stratos_brain_api_key_2024";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));
  app.use(express.json());

  // Guru API Proxy Route
  app.use("/api/investor-api", async (req, res) => {
    try {
      const endpoint = req.path; // e.g., /search, /track
      const query = req.query;
      
      console.log(`Proxying guru request to: ${GURU_API_URL}${endpoint}`);
      
      const response = await axios({
        method: req.method,
        url: `${GURU_API_URL}${endpoint}`,
        params: query,
        data: req.body,
        headers: {
          "x-stratos-key": STRATOS_API_KEY,
          "Content-Type": "application/json"
        }
      });
      
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Guru API proxy error:", error.message);
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: "Internal Proxy Error" });
      }
    }
  });

  // API Proxy Route
  app.use("/api/dashboard", async (req, res) => {
    try {
      const endpoint = req.path; // e.g., /health, /inflections
      const query = req.query;
      
      console.log(`Proxying request to: ${SUPABASE_URL}/dashboard${endpoint}`);
      
      const response = await axios({
        method: req.method,
        url: `${SUPABASE_URL}/dashboard${endpoint}`,
        params: query,
        headers: {
          "x-stratos-key": STRATOS_API_KEY,
          "Content-Type": "application/json"
        },
        // Don't transform response data for HTML content
        responseType: endpoint.includes('memo-pdf') ? 'text' : 'json'
      });
      
      // Check if this is the memo-pdf endpoint (returns HTML)
      if (endpoint.includes('memo-pdf')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(response.status).send(response.data);
      } else {
        res.status(response.status).json(response.data);
      }
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: "Internal Proxy Error" });
      }
    }
  });

  // Supply Chain API Route (direct database query)
  app.get("/api/supply-chain/tiers", async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        'https://wfogbaipiqootjrsprde.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw'
      );
      
      // Fetch tiers
      const { data: tiers, error: tiersError } = await supabase
        .from('supply_chain_tiers')
        .select('*')
        .order('display_order');
      
      if (tiersError) throw tiersError;
      
      // Fetch categories
      const { data: categories, error: catsError } = await supabase
        .from('supply_chain_categories')
        .select('*')
        .order('display_order');
      
      if (catsError) throw catsError;
      
      // Fetch company mappings with asset data
      const { data: mappings, error: mappingsError } = await supabase
        .from('asset_supply_chain_mapping')
        .select(`
          *,
          assets:asset_id (
            asset_id,
            symbol,
            name,
            asset_type,
            is_active
          )
        `);
      
      if (mappingsError) throw mappingsError;
      
      // Fetch equity metadata for financial data
      const symbols = mappings
        ?.filter(m => m.assets?.symbol)
        .map(m => m.assets.symbol) || [];
      
      const { data: equityData, error: eqError } = await supabase
        .from('equity_metadata')
        .select('symbol, market_cap, revenue_ttm, profit_margin, ev_to_revenue, ev_to_ebitda')
        .in('symbol', symbols);
      
      const equityMap = new Map(equityData?.map(e => [e.symbol, e]) || []);
      
      // Fetch private companies
      const { data: privateCompanies, error: privError } = await supabase
        .from('private_companies')
        .select('*');
      
      if (privError) throw privError;
      
      // Build response structure
      const result = tiers?.map(tier => {
        const tierCategories = categories?.filter(c => c.tier_id === tier.tier_id) || [];
        
        return {
          ...tier,
          categories: tierCategories.map(cat => {
            // Get public companies for this category
            const catMappings = mappings?.filter(m => m.category_id === cat.category_id && m.assets?.is_active) || [];
            const publicCompanies = catMappings.map(m => {
              const eq = equityMap.get(m.assets?.symbol);
              return {
                company_id: `public_${m.assets?.asset_id}`,
                company_type: 'public',
                symbol: m.assets?.symbol,
                name: m.assets?.name,
                asset_id: m.assets?.asset_id,
                role_description: m.role_description,
                market_share_percent: m.market_share_percent,
                competitive_position: m.competitive_position,
                key_products: m.key_products,
                display_order: m.display_order,
                market_cap: eq?.market_cap,
                revenue_ttm: eq?.revenue_ttm,
                profit_margin: eq?.profit_margin,
                ev_to_revenue: eq?.ev_to_revenue,
                ev_to_ebitda: eq?.ev_to_ebitda,
                return_1d: null,
                return_7d: null,
                return_30d: null,
                return_1y: null
              };
            });
            
            // Get private companies for this category
            const catPrivate = privateCompanies?.filter(p => p.category_id === cat.category_id) || [];
            const privateComps = catPrivate.map(p => ({
              company_id: `private_${p.company_id}`,
              company_type: 'private',
              symbol: null,
              name: p.name,
              role_description: p.role_description,
              market_share_percent: null,
              competitive_position: p.competitive_position,
              key_products: p.key_products,
              display_order: p.display_order,
              market_cap: null,
              revenue_ttm: null,
              profit_margin: null,
              ev_to_revenue: null,
              ev_to_ebitda: null,
              estimated_valuation: p.estimated_valuation,
              estimated_revenue: p.estimated_revenue,
              funding_stage: p.funding_stage,
              total_funding: p.total_funding,
              key_investors: p.key_investors,
              return_1d: null,
              return_7d: null,
              return_30d: null,
              return_1y: null
            }));
            
            return {
              ...cat,
              public_company_count: publicCompanies.length,
              private_company_count: privateComps.length,
              companies: [...publicCompanies, ...privateComps].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            };
          })
        };
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Supply chain API error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Handle client-side routing - serve index.html for all other routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`API Proxy configured for: ${SUPABASE_URL}`);
  });
}

startServer().catch(console.error);
// Updated Mon Jan 12 05:53:57 EST 2026
