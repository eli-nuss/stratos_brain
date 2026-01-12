import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api/dashboard": {
        target: "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api/dashboard",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dashboard/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.setHeader("x-stratos-key", process.env.STRATOS_BRAIN_API_KEY || "stratos_brain_api_key_2024");
          });
        },
      },
      "/api/company-chat-api": {
        target: "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/company-chat-api",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/company-chat-api/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.setHeader("x-stratos-key", process.env.STRATOS_BRAIN_API_KEY || "stratos_brain_api_key_2024");
          });
        },
      },
      "/api/global-chat-api": {
        target: "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/global-chat-api",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/global-chat-api/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.setHeader("x-stratos-key", process.env.STRATOS_BRAIN_API_KEY || "stratos_brain_api_key_2024");
          });
        },
      },
    },
  },
});
