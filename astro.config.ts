import { createReadStream, existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";

/** Serves the snapshot's videos, .content/media/, at /media: from the dev server, and copied into dist/media/. */
const media: AstroIntegration = {
  name: "media",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.middlewares.use("/media", (req, res, next) => {
        const path = join(".content/media", basename(decodeURIComponent(req.url ?? "")));
        if (!existsSync(path)) return next();
        res.setHeader("Content-Type", "video/mp4");
        createReadStream(path).pipe(res);
      });
    },
    "astro:build:done": async ({ dir }) => {
      if (existsSync(".content/media"))
        await cp(".content/media", join(fileURLToPath(dir), "media"), { recursive: true });
    },
  },
};

export default defineConfig({
  site: "https://cyccommunitysailing.org",
  output: "static",
  // Every page is a file, such as /donate.html, so Firebase Hosting's clean URLs keep Wix's paths: /donate.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [sitemap(), media],
  vite: { plugins: [tailwindcss()] },
});
