import { test } from "@playwright/test";

// For a UI PR's description (AGENTS.md): `mise run screenshots` saves each page at both review sizes to screenshots/.
const pages = [
  ["home", "/"],
  ["category", "/program-category/summer-camp"],
  ["program", "/program/opti-race-team"],
  ["crew", "/our-crew"],
  ["sponsorships", "/sponsorships"],
  ["policy", "/policy/cancellation-policy"],
] as const;
const sizes = { laptop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;

for (const [name, path] of pages) {
  for (const [size, viewport] of Object.entries(sizes)) {
    test(`${name} at ${size}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      for (const img of await page.locator("img").all()) await img.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `screenshots/${name}-${size}.png`, fullPage: true });
    });
  }
}
