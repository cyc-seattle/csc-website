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

test("every page loads, with a heading, its pictures, and links that work", async ({ page }) => {
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

      for (const href of await page
        .locator("a[href^='/']")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
        links.add(href.split("#")[0]!);
      }
    });
  }

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
  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Contact Us" }).first()).toBeVisible();
  await context.close();
});
