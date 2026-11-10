import { defineConfig } from "@playwright/test";

// Runs against the built site in dist/, which `mise run smoke` builds from the fixtures first.
export default defineConfig({
  testDir: "test/smoke",
  // Screenshots are for PR descriptions, not checks (AGENTS.md).
  testIgnore: process.env["SCREENSHOTS"] ? [] : ["screenshots.spec.ts"],
  reporter: "list",
  forbidOnly: !!process.env["CI"],
  use: {
    baseURL: "http://localhost:4329",
    // The laptop size from cyc:conventions.
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    // Not Astro's usual 4321, so a dev server left running never answers in its place.
    // --ignore-lock keeps it in the foreground, even where Astro would detect a coding agent and background it.
    command: "pnpm exec astro preview --port 4329 --ignore-lock",
    url: "http://localhost:4329",
  },
});
