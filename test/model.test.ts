import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildContent,
  currentVersion,
  dollars,
  faqTopics,
  programAction,
  resolveFileReferences,
  type Policy,
  type Program,
} from "../src/lib/model.ts";
import { fileKind, referencedFiles, type Snapshot } from "../src/lib/snapshot.ts";

const fixtures = JSON.parse(readFileSync("test/fixtures/content.json", "utf8")) as Snapshot;
const content = buildContent(fixtures);

describe("currentVersion", () => {
  const policy: Policy = {
    slug: "cancellation-policy",
    title: "Cancellation Policy",
    inFooter: true,
    versions: [
      { title: "First", effective: "2024-01-01", body: "" },
      { title: "Second", effective: "2025-03-01", body: "" },
      { title: "Next year's", effective: "2099-01-01", body: "" },
    ],
  };

  it("is the latest version that has started", () => {
    expect(currentVersion(policy, "2026-11-09")?.title).toBe("Second");
  });

  it("starts on its effective date", () => {
    expect(currentVersion(policy, "2025-03-01")?.title).toBe("Second");
    expect(currentVersion(policy, "2025-02-28")?.title).toBe("First");
  });

  it("is the first version when none has started yet", () => {
    expect(currentVersion(policy, "2020-01-01")?.title).toBe("First");
  });

  it("is undefined for a policy with no versions", () => {
    expect(currentVersion({ ...policy, versions: [] }, "2026-11-09")).toBeUndefined();
  });

  it("finds versions in date order whatever order Directus returns them in", () => {
    const cancellation = content.policies.find((p) => p.slug === "cancellation-policy")!;
    expect(currentVersion(cancellation, "2026-11-09")?.effective).toBe("2025-03-01");
  });
});

describe("programAction", () => {
  const program: Program = {
    slug: "opti-race-team",
    title: "Opti Race Team",
    subtitle: "",
    summary: "",
    cardImage: undefined,
    banner: undefined,
    body: "",
    registrationLabel: "Sign Up",
    registrationUrl: "https://register.example.org/opti",
    gallery: [],
  };

  it("sends an open category's program to its sign-up page", () => {
    expect(programAction(program, "open")).toEqual({ label: "Sign Up", href: "https://register.example.org/opti" });
  });

  it("says Register Now when the program has no label of its own", () => {
    expect(programAction({ ...program, registrationLabel: "" }, "open").label).toBe("Register Now");
  });

  it("sends an open category's program with no sign-up page to its own page", () => {
    expect(programAction({ ...program, registrationUrl: undefined }, "open")).toEqual({
      label: "Learn More",
      href: "/program/opti-race-team",
    });
  });

  it("sends a program coming soon to the newsletter", () => {
    expect(programAction(program, "coming_soon")).toEqual({ label: "Get Notified", href: "/newsletter" });
  });

  it("sends a closed category's program to its own page", () => {
    expect(programAction(program, "closed")).toEqual({ label: "Learn More", href: "/program/opti-race-team" });
  });
});

describe("faqTopics", () => {
  const topics = faqTopics({
    website_faq_topics: [
      { id: "t1", title: "Camp Registration", heading: "Registration Questions" },
      { id: "t2", title: "Camp Other Questions", heading: null },
      { id: "t3", title: "Nothing yet", heading: null },
    ],
    website_faqs: [
      { id: "q1", topic_id: "t1", sort: 2, question: "Second?", answer: "Yes." },
      { id: "q2", topic_id: "t2", sort: 1, question: "Rain?", answer: null },
      { id: "q3", topic_id: "t1", sort: 1, question: "First?", answer: "Yes." },
      { id: "q4", topic_id: "t1", sort: null, question: "Unsorted?", answer: "Last." },
    ],
  });

  it("puts each question under its topic, in sort order, unsorted last", () => {
    expect(topics.get("t1")?.questions.map((q) => q.question)).toEqual(["First?", "Second?", "Unsorted?"]);
    expect(topics.get("t2")?.questions).toEqual([{ question: "Rain?", answer: "" }]);
  });

  it("shows a topic's heading, or its title when it has none", () => {
    expect(topics.get("t1")?.heading).toBe("Registration Questions");
    expect(topics.get("t2")?.heading).toBe("Camp Other Questions");
  });

  it("leaves out a topic with no questions", () => {
    expect(topics.has("t3")).toBe(false);
  });

  it("gives a page its topics in the order the page lists them", () => {
    const camp = content.categories.find((c) => c.slug === "summer-camp")!;
    expect(camp.faqTopics.map((t) => t.heading)).toEqual(["Registration Questions", "Summer Camp Other Questions"]);
    const scholarships = content.pages.find((p) => p.slug === "scholarships")!;
    expect(scholarships.faqTopics.map((t) => t.heading)).toEqual(["Scholarship Questions"]);
  });
});

describe("buildContent", () => {
  it("leaves hidden programs out of the site and out of their categories", () => {
    expect(content.programs.map((p) => p.slug)).not.toContain("retired-program");
    const camp = content.categories.find((c) => c.slug === "summer-camp")!;
    expect(camp.programs.map((p) => p.slug)).toEqual(["learn-to-sail", "adventure-camp"]);
  });

  it("sorts categories, and a category's crew and photos, as Directus does", () => {
    expect(content.categories.map((c) => c.slug)).toEqual([
      "summer-camp",
      "junior-race-teams",
      "community-boating",
      "adventure-sailing",
    ]);
    const camp = content.categories[0]!;
    expect(camp.profiles.map((p) => p.name)).toEqual(["Casey Example", "Morgan Test"]);
    expect(camp.gallery).toHaveLength(5);
  });

  it("splits the address into lines", () => {
    expect(content.settings.address).toEqual(["100 Example Way NW", "Seattle, WA 98000"]);
  });

  it("names each sponsor's level", () => {
    expect(content.sponsors).toEqual([expect.objectContaining({ name: "Example Co.", level: "Test Level Two" })]);
  });

  it("makes an action only when it has both a label and a link", () => {
    const donate = content.pages.find((p) => p.slug === "donate")!;
    expect(donate.sections.map((s) => s.action?.href)).toEqual(["https://give.example.org", "/contact-us", undefined]);
  });
});

describe("dollars", () => {
  it("shows whole dollars without cents", () => {
    expect(dollars(150000)).toBe("$1,500");
  });

  it("shows cents when there are some", () => {
    expect(dollars(25050)).toBe("$250.50");
  });
});

describe("resolveFileReferences", () => {
  const video = "00000000-0000-4000-8000-000000000011";
  const poster = "00000000-0000-4000-8000-000000000004";
  const url = async (id: string) => `/url-for/${id}`;

  it("swaps a video's and its poster's file IDs for their URLs", async () => {
    expect(await resolveFileReferences(`<video controls src="${video}" poster="${poster}"></video>`, url)).toBe(
      `<video controls src="/url-for/${video}" poster="/url-for/${poster}"></video>`,
    );
  });

  it("swaps a Markdown picture's file ID", async () => {
    expect(await resolveFileReferences(`<p><img src="${poster}" alt="A boat"></p>`, url)).toBe(
      `<p><img src="/url-for/${poster}" alt="A boat"></p>`,
    );
  });

  it("leaves other addresses alone", async () => {
    const html = `<img src="https://example.org/a.jpg"><a href="${poster}">link</a>`;
    expect(await resolveFileReferences(html, url)).toBe(html);
  });
});

describe("referencedFiles", () => {
  it("finds every picture the fixtures name, and the fixtures have each one", () => {
    const ids = referencedFiles(fixtures);
    expect(ids.size).toBeGreaterThan(5);
    const files = new Set(fixtures.files.map((f) => f.id));
    expect([...ids].filter((id) => !files.has(id))).toEqual([]);
  });
});

describe("fileKind", () => {
  it("goes by the file's type", () => {
    expect(fileKind({ type: "image/jpeg", filename_download: "a.bin" })).toBe("picture");
    expect(fileKind({ type: "video/mp4", filename_download: "a.bin" })).toBe("video");
    expect(fileKind({ type: "application/pdf", filename_download: "a.jpg" })).toBeUndefined();
  });

  it("goes by the extension when Directus has no real type", () => {
    expect(fileKind({ type: "application/octet-stream", filename_download: "Boat.JPEG" })).toBe("picture");
    expect(fileKind({ type: null, filename_download: "practice.mp4" })).toBe("video");
    expect(fileKind({ type: "application/octet-stream", filename_download: "notes.txt" })).toBeUndefined();
  });
});
