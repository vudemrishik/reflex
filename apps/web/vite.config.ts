import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Expose BACKEND_API_URL (instead of the default VITE_* prefix) to the browser.
  envPrefix: ["VITE_", "BACKEND_"],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  // Resolve the linked workspace package as source (it ships raw TS, no build).
  optimizeDeps: {
    exclude: ["@reflex/engine"],
  },
});
