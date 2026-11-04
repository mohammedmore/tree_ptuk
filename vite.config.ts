import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Security: only VITE_ prefixed env vars are exposed to the client bundle
  envPrefix: ["VITE_"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("@xyflow") ||
              id.includes("@reactflow") ||
              id.includes("zustand")
            ) {
              return "vendor-xyflow";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("jspdf")) {
              return "vendor-jspdf";
            }
            if (id.includes("html-to-image") || id.includes("html2canvas")) {
              return "vendor-canvas";
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
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error:
                    "تعذر الاتصال بخادم المزامنة المحلي (Port 3001). يرجى تشغيل الخادم عبر npm run start أو npm run dev:all.",
                  code: "BACKEND_OFFLINE",
                }),
              );
            }
          });
        },
      },
    },
  },
});
