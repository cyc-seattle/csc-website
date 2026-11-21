import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const csp = () => {
  const hosting = JSON.parse(readFileSync("firebase.json", "utf8"));
  const headers = hosting.hosting.headers.flatMap((h: { headers: { key: string; value: string }[] }) => h.headers);
  return headers.find((h: { key: string }) => h.key === "Content-Security-Policy").value as string;
};
const directive = (name: string) =>
  csp()
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1);

describe("the site's security header", () => {
  it("runs the newsletter form's script by its hash, and no other inline script", () => {
    const script = readFileSync("src/scripts/join-name.js", "utf8");
    const hash = `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
    expect(directive("script-src")).toEqual(["'self'", hash]);
  });

  it("lets the forms post to mail.cyccommunitysailing.org, and come back to the site", () => {
    // form-action also covers the redirect after a post, back to the site's result pages.
    expect(directive("form-action")).toEqual([
      "'self'",
      "https://mail.cyccommunitysailing.org",
      "https://cyccommunitysailing.org",
    ]);
  });
});
