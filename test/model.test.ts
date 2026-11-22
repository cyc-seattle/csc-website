import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ages,
  buildContent,
  categoryStatus,
  datesSummary,
  dayRange,
  spotsLeft,
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
const content = buildContent(fixtures, "2026-11-21");

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
    ages: "",
    summary: "",
    cardImage: undefined,
    banner: undefined,
    body: "",
    dates: [],
    registration: "none",
    gallery: [],
  };
  const open = {
    form: "2027 Spring",
    registerUrl: "https://theclubspot.com/register/camp/c1/class",
    opensOn: undefined,
    rows: [],
  };

  it("sends a program taking registrations to its Clubspot camp, whatever its category says", () => {
    expect(programAction({ ...program, dates: [open], registration: "open" }, "closed")).toEqual({
      label: "Register",
      href: "https://theclubspot.com/register/camp/c1/class",
    });
  });

  it("sends a program whose offerings aren't open yet to the newsletter", () => {
    const coming = { ...program, dates: [{ ...open, registerUrl: undefined }], registration: "coming" as const };
    expect(programAction(coming, "closed")).toEqual({ label: "Get Notified", href: "/newsletter" });
  });

  it("follows its category when nothing is coming up", () => {
    expect(programAction(program, "coming_soon")).toEqual({ label: "Get Notified", href: "/newsletter" });
    expect(programAction(program, "closed")).toEqual({ label: "Learn More", href: "/program/opti-race-team" });
    expect(programAction(program, "open")).toEqual({ label: "Learn More", href: "/program/opti-race-team" });
  });
});

describe("what's on sale", () => {
  const today = "2026-11-21";
  const at = buildContent(fixtures, today);
  const program = (slug: string) => at.programs.find((p) => p.slug === slug)!;

  it("shows a page's offerings that aren't over, by form, with their price", () => {
    const camp = program("learn-to-sail");
    expect(camp.dates.map((g) => [g.form, g.rows.map((r) => [r.label, r.startsOn, r.priceCents])])).toEqual([
      [
        "2027 Summer Sailing Camps",
        [
          ["Week 1", "2027-06-21", 67500],
          ["Week 2", "2027-06-28", 67500],
        ],
      ],
    ]);
  });

  it("says when registration opens, before a form's camp takes it", () => {
    const camp = program("learn-to-sail");
    expect(camp.registration).toBe("coming");
    expect(camp.dates[0]).toMatchObject({ registerUrl: undefined, opensOn: "2027-02-22" });
  });

  it("names each program on a page that covers several, and links to the camp taking registrations", () => {
    const opti = program("opti-race-team");
    expect(opti.registration).toBe("open");
    expect(opti.ages).toBe("Ages 8–15");
    expect(opti.dates).toEqual([
      {
        form: "2027 Spring Singlehanded Race Teams",
        registerUrl: "https://theclubspot.com/register/camp/springOpti/class",
        opensOn: undefined,
        rows: [
          {
            label: "Opti Development Race Team",
            startsOn: "2027-03-01",
            endsOn: "2027-05-23",
            priceCents: 67500,
            spots: "1 spot left",
          },
          {
            label: "Opti Race Team",
            startsOn: "2027-03-01",
            endsOn: "2027-05-23",
            priceCents: 75000,
            spots: "Full. Join the waitlist.",
          },
          {
            label: "Opti Regional Race Team",
            startsOn: "2027-03-01",
            endsOn: "2027-05-23",
            priceCents: 140000,
            spots: "",
          },
        ],
      },
    ]);
  });

  it("has nothing for a page with no programs in the catalog", () => {
    expect(program("laser-race-team")).toMatchObject({ dates: [], registration: "none", ages: "" });
  });

  it("opens a category when one of its programs takes registrations, and says when the rest open", () => {
    const opened = at.categories.find((c) => c.programs.some((p) => p.slug === "opti-race-team"))!;
    expect(opened.status).toBe("open");
    expect(categoryStatus("closed", [program("learn-to-sail")])).toBe("coming_soon");
    expect(categoryStatus("open", [])).toBe("open");
  });
});

describe("ages", () => {
  it("says the youngest and oldest, either alone, or nothing", () => {
    expect(ages(6, 8)).toBe("Ages 6–8");
    expect(ages(18, null)).toBe("Ages 18 and up");
    expect(ages(null, 12)).toBe("Up to age 12");
    expect(ages(10, 10)).toBe("Age 10");
    expect(ages(null, null)).toBe("");
  });
});

describe("spotsLeft", () => {
  it("shows spots only when 5 or fewer are left, and full at none", () => {
    expect(spotsLeft(12, 0, false)).toBe("");
    expect(spotsLeft(12, 7, false)).toBe("5 spots left");
    expect(spotsLeft(12, 11, false)).toBe("1 spot left");
    expect(spotsLeft(12, 12, false)).toBe("Full. Join the waitlist.");
    expect(spotsLeft(12, 13, false)).toBe("Full. Join the waitlist.");
  });

  it("shows nothing when Clubspot hides spots left, or there's no limit", () => {
    expect(spotsLeft(12, 12, true)).toBe("");
    expect(spotsLeft(null, 3, false)).toBe("");
  });
});

describe("dayRange", () => {
  it("writes a span as short as it can be read", () => {
    expect(dayRange("2027-06-21", "2027-06-25")).toBe("Jun 21–25");
    expect(dayRange("2027-06-28", "2027-07-02")).toBe("Jun 28 – Jul 2");
    expect(dayRange("2026-12-01", "2027-02-28")).toBe("Dec 1, 2026 – Feb 28, 2027");
    expect(dayRange("2027-06-21", null)).toBe("Jun 21, 2027");
  });
});

describe("datesSummary", () => {
  it("gives the first and last day, and the price, from the lowest when they differ", () => {
    const at = buildContent(fixtures, "2026-11-21");
    expect(datesSummary(at.programs.find((p) => p.slug === "learn-to-sail")!)).toBe("Jun 21 – Jul 2 · $675");
    expect(datesSummary(at.programs.find((p) => p.slug === "opti-race-team")!)).toBe("Mar 1 – May 23 · from $675");
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
