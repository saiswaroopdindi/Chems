import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves your site under /<repo-name>/ for project sites.
  // To avoid blank pages due to a mismatched base (case-sensitive), auto-detect
  // the repo name in GitHub Actions. Locally, use "/" for dev.
  base: process.env.GITHUB_ACTIONS
    ? `/${(process.env.GITHUB_REPOSITORY || "").split("/")[1] || ""}/`
    : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"]
  }
});

