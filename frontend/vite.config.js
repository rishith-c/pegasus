import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api -> backend (:8001) so the browser never hits CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
