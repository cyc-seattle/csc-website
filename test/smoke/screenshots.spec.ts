import { test } from "@playwright/test";

// For a UI PR's description (AGENTS.md): `mise run screenshots` saves each page at both review sizes to screenshots/.
const pages = [
  ["home", "/"],
  ["category", "/program-category/summer-camp"],
  ["program", "/program/opti-race-team"],
  ["crew", "/our-crew"],
  ["donate", "/donate"],
  ["contact", "/contact-us"],
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

// Close-ups of each schedule at twice the size, to check its gaps and stripes.
const schedules = [["summer-schedule", "/program-category/summer-camp"]] as const;
for (const [name, path] of schedules) {
  for (const [size, viewport] of Object.entries(sizes)) {
    test(`${name} close-up at ${size}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await page.goto(path);
      // A laptop shows the group's schedule; a phone, each card's own weeks.
      const schedule =
        size === "laptop" ? page.locator(".card:has(> .schedule-title)") : page.locator(".card:has(.schedule-cell)");
      await schedule.first().screenshot({ path: `screenshots/${name}-${size}.png` });
      await context.close();
    });
  }
}
