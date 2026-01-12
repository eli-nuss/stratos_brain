import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_URL = "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api";
const GURU_API_URL = "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/guru-api";
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
  app.use("/api/guru-api", async (req, res) => {
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
