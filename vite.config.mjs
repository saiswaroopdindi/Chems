import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves your site under /<repo-name>/ (unless using a custom domain).
  // If your repository name differs, update "Chems" below.
  base: "/Chems/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"]
  }
});

