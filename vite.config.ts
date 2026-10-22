import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_", "SUPABASE_PUBLISHABLE_KEY"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@xyflow")) {
              return "vendor-xyflow";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (
              id.includes("jspdf") ||
              id.includes("html-to-image") ||
              id.includes("html2canvas")
            ) {
              return "vendor-export";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            if (id.includes("dagre")) {
              return "vendor-dagre";
            }
          }
        },
      },
    },
  },
  server: {
    // HMR can be disabled in hosted development environments.
    hmr: process.env.DISABLE_HMR !== "true",
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
