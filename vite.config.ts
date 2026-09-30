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
  server: {
    // HMR can be disabled in hosted development environments.
    hmr: process.env.DISABLE_HMR !== "true",
    host: true,
  },
});
