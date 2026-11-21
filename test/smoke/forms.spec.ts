import { expect, test, type Page } from "@playwright/test";

const subscribe = "https://mail.cyccommunitysailing.org/subscription/form";

/** Fills in the newsletter form and returns the fields it posts to Listmonk, without leaving the site. */
async function signUp(page: Page): Promise<URLSearchParams> {
  let posted: URLSearchParams | undefined;
  await page.route(subscribe, async (route) => {
    posted = new URLSearchParams(route.request().postData() ?? "");
    await route.fulfill({ status: 204 });
  });
  await page.goto("/newsletter");
  await page.getByLabel("First name").fill("Pat");
  await page.getByLabel("Last name").fill("Example");
  await page.getByLabel("Email").fill("pat@example.com");
  await page.getByLabel("Yes, subscribe me").check();
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect.poll(() => posted).toBeDefined();
  return posted!;
}

test("the contact form posts to Directus on the public domain, with a hidden field for bots", async ({ page }) => {
  await page.goto("/contact-us");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Send" }) });
  await expect(form).toHaveAttribute("method", "post");
  await expect(form).toHaveAttribute("action", "https://mail.cyccommunitysailing.org/forms/contact");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await expect(form.locator('input[name="website"]')).not.toBeInViewport();
  await expect(page.getByText("isn't connected yet")).toHaveCount(0);
});

test("the newsletter form joins first and last name into Listmonk's one name", async ({ page }) => {
  const posted = await signUp(page);
  expect(posted.get("name")).toBe("Pat Example");
  expect(posted.get("email")).toBe("pat@example.com");
  expect(posted.get("l")).toMatch(/^[0-9a-f-]{36}$/);
  expect(posted.get("next")).toBe("https://cyccommunitysailing.org/newsletter/check-your-email");
  expect(posted.get("nonce")).toBe("");
});

test("the newsletter form still signs up without JavaScript, with no name", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const posted = await signUp(page);
  expect(posted.get("email")).toBe("pat@example.com");
  expect(posted.get("name")).toBe("");
  await context.close();
});

test("the pages a form sends a visitor to load, and stay out of search", async ({ page }) => {
  for (const [path, heading] of [
    ["/contact-us/sent", "Message Sent"],
    ["/contact-us/not-sent", "Message Not Sent"],
    ["/newsletter/check-your-email", "Check Your Email"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  }
  const sitemap = await (await page.request.get("/sitemap-0.xml")).text();
  expect(sitemap).not.toContain("/contact-us/");
  expect(sitemap).not.toContain("/newsletter/");
});
