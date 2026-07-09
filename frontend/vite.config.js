import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // alle externe hosts toestaan (bv. ngrok-tunnels)
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
