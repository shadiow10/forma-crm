import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "client", "src") },
  },
  envDir: import.meta.dirname,
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    // Vercel's Output Directory is set to dist/public.
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
