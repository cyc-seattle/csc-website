import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://cyccommunitysailing.org",
  output: "static",
  // Every page is a file, such as /donate.html, so Firebase Hosting's clean URLs keep Wix's paths: /donate.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
