import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this project from /SteamPulseWeb/.
  // Local development still uses the root path.
  base: process.env.GITHUB_ACTIONS ? "/SteamPulseWeb/" : "/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001"
    }
  }
});
