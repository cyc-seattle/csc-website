import { expect, test, type Page } from "@playwright/test";

// Every page the sitemap lists, as a path such as /donate.
async function sitemapPaths(page: Page): Promise<string[]> {
  const response = await page.request.get("/sitemap-0.xml");
  expect(response.ok()).toBe(true);
  return [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
}

test("the sitemap lists every page", async ({ page }) => {
  const paths = await sitemapPaths(page);
  for (const path of ["/", "/contact-us", "/donate", "/program-category/summer-camp", "/program/opti-race-team"]) {
    expect(paths).toContain(path);
  }
  expect(paths).not.toContain("/program/retired-program");
});

test("every page loads, with a heading, its pictures and videos, and links that work", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${page.url()}: ${m.text()}`);
  });
  const links = new Set<string>();

  for (const path of await sitemapPaths(page)) {
    await test.step(path, async () => {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();

      // Loads the lazy pictures too, then checks that each one has pixels.
      for (const img of await page.locator("img").all()) await img.scrollIntoViewIfNeeded();
      const broken = await page
        .locator("img")
        .evaluateAll((imgs: HTMLImageElement[]) =>
          imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src),
        );
      expect(broken, path).toEqual([]);

      const media = await page
        .locator("video")
        .evaluateAll((vs) => vs.flatMap((v) => [v.getAttribute("src"), v.getAttribute("poster")]));
      for (const src of media) if (src) links.add(src);

      for (const href of await page
        .locator("a[href^='/']")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
        links.add(href.split("#")[0]!);
      }
    });
  }

  expect([...links]).toContain("/media/00000000-0000-4000-8000-000000000011.mp4");
  for (const href of links) {
    const response = await page.request.get(href);
    expect(response.status(), `link to ${href}`).toBe(200);
  }
  expect(errors).toEqual([]);
});

test("a page that doesn't exist says so", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
});

test("the phone menu opens without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  // Contact Us sits in the phone header already, so check one of the menu's own links instead.
  const firstItem = page.locator("details nav a").first();
  await expect(firstItem).toBeHidden();
  await page.getByLabel("Menu", { exact: true }).click();
  await expect(firstItem).toBeVisible();
  await context.close();
});

test("no page is wider than a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const path of await sitemapPaths(page)) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
  }
  await context.close();
});

test("every cell in a schedule is the same height, whatever it holds", async ({ browser }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const path of [
      "/program-category/summer-camp",
      "/program-category/junior-race-teams",
      "/program-category/adult-sailing-classes",
    ]) {
      await page.goto(path);
      // Each schedule's visible cells, by height: one height per schedule.
      const heights = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".card"), (schedule) => {
          const cells = Array.from(schedule.querySelectorAll(".schedule-cell"), (c) => c as HTMLElement);
          return [...new Set(cells.filter((c) => c.offsetParent).map((c) => c.offsetHeight))];
        }),
      );
      for (const h of heights.filter((h) => h.length > 0)) expect(h, `${path} at ${viewport.width}px`).toHaveLength(1);
    }
    await context.close();
  }
});
