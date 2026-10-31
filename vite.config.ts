import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from the phone over local Wi-Fi
    port: 5173,
    // API runs in wrangler (`npm run dev:api`) with a local copy of D1
    proxy: { "/api": "http://localhost:8788" },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
