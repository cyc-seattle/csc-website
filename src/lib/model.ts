// Turns the snapshot's Directus rows into what the pages show. Pure, so the tests run it on the fixtures.

import type { Id, Link, Snapshot } from "./snapshot.ts";

export type Status = "open" | "closed" | "coming_soon";

export interface Action {
  label: string;
  href: string;
}

export interface Settings {
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string[];
  mapUrl: string;
  ein: string;
  social: { label: string; url: string }[];
  announcement: string;
  logo: Id | undefined;
  badge: Id | undefined;
  menu: { label: string; items: Action[] }[];
}

export interface FaqTopic {
  id: Id;
  heading: string;
  questions: { question: string; answer: string }[];
}

export interface Profile {
  id: Id;
  name: string;
  title: string;
  bio: string;
  photo: Id | undefined;
  groups: string[];
}

export interface Program {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  cardImage: Id | undefined;
  banner: Id | undefined;
  body: string;
  registrationLabel: string;
  registrationUrl: string | undefined;
  gallery: Id[];
}

export interface Category {
  slug: string;
  title: string;
  summary: string;
  status: Status;
  image: Id | undefined;
  banner: Id | undefined;
  top: string;
  bottom: string;
  testimonial: string;
  programs: Program[];
  faqTopics: FaqTopic[];
  profiles: Profile[];
  gallery: Id[];
}

export interface Section {
  title: string;
  image: Id | undefined;
  body: string;
  action: Action | undefined;
}

export interface Page {
  slug: string;
  title: string;
  description: string;
  banner: Id | undefined;
  image: Id | undefined;
  body: string;
  action: Action | undefined;
  sections: Section[];
  faqTopics: FaqTopic[];
}

export interface PolicyVersion {
  title: string;
  /** An ISO date, such as 2026-05-01. */
  effective: string;
  body: string;
}

export interface Policy {
  slug: string;
  title: string;
  inFooter: boolean;
  versions: PolicyVersion[];
}

export interface Sponsor {
  name: string;
  url: string | undefined;
  logo: Id | undefined;
  /** The sponsor's level's name, if it has one. */
  level: string | undefined;
}

export interface SponsorLevel {
  name: string;
  amountCents: number;
  benefits: string;
}

export interface File {
  id: Id;
  filename: string;
  /** Its MIME type, such as image/jpeg or video/mp4. */
  type: string;
  alt: string;
}

export interface Content {
  settings: Settings;
  pages: Page[];
  categories: Category[];
  programs: Program[];
  profiles: Profile[];
  policies: Policy[];
  sponsorLevels: SponsorLevel[];
  sponsors: Sponsor[];
  files: File[];
}

const last = Number.MAX_SAFE_INTEGER;
const bySort = (a: { sort: number | null }, b: { sort: number | null }) => (a.sort ?? last) - (b.sort ?? last);

/** The rows a sorted many-to-many list links `id` to, in its order, skipping any the snapshot doesn't have. */
function linked<A extends string, B extends string, T>(
  links: Link<A, B>[],
  from: A,
  to: B,
  id: Id,
  rows: Map<Id, T>,
): T[] {
  return links
    .filter((l) => l[from] === id)
    .toSorted(bySort)
    .map((l) => rows.get(l[to]))
    .filter((r) => r !== undefined);
}

function action(label: string | null, url: string | null): Action | undefined {
  return label && url ? { label, href: url } : undefined;
}

/** Each topic's questions, in order. A topic with none is left out. */
export function faqTopics(snapshot: Pick<Snapshot, "website_faq_topics" | "website_faqs">): Map<Id, FaqTopic> {
  const topics = new Map<Id, FaqTopic>();
  for (const t of snapshot.website_faq_topics) {
    const questions = snapshot.website_faqs
      .filter((q) => q.topic_id === t.id)
      .toSorted(bySort)
      .map((q) => ({ question: q.question, answer: q.answer ?? "" }));
    if (questions.length > 0) topics.set(t.id, { id: t.id, heading: t.heading || t.title, questions });
  }
  return topics;
}

/** A policy's version in effect on `today`: the latest that has started, or the first if none has. */
export function currentVersion(policy: Policy, today: string): PolicyVersion | undefined {
  const started = policy.versions.filter((v) => v.effective <= today);
  return started.at(-1) ?? policy.versions[0];
}

/**
 * Where a program's main button goes. An open category sends it to Clubspot, if the program has a sign-up page. A
 * category coming soon sends it to the newsletter. Otherwise it goes to the program's own page.
 */
export function programAction(program: Program, status: Status): Action {
  if (status === "open" && program.registrationUrl?.startsWith("http"))
    return { label: program.registrationLabel || "Register Now", href: program.registrationUrl };
  if (status === "coming_soon") return { label: "Get Notified", href: "/newsletter" };
  return { label: "Learn More", href: `/program/${program.slug}` };
}

/** Whole dollars when it's even, such as $1,500, and cents only when there are some. */
export function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

const fileReference = /\b(src|poster)="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;

/**
 * Markdown names a Website-folder file by its ID, as in `<video src="<id>" poster="<id>">` or `![](<id>)`. This
 * swaps each ID in the rendered HTML for the URL `url` gives it.
 */
export async function resolveFileReferences(html: string, url: (id: Id) => Promise<string>): Promise<string> {
  const ids = new Set([...html.matchAll(fileReference)].map((m) => m[2]!));
  const urls = new Map(await Promise.all([...ids].map(async (id) => [id, await url(id)] as const)));
  return html.replace(fileReference, (_, attribute: string, id: string) => `${attribute}="${urls.get(id)}"`);
}

export function buildContent(snapshot: Snapshot): Content {
  const s = snapshot.website_settings;
  const settings: Settings = {
    name: s.name,
    description: s.description ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    address: (s.address ?? "").split("\n").filter(Boolean),
    mapUrl: s.map_url ?? "",
    ein: s.ein ?? "",
    social: s.social ?? [],
    announcement: s.announcement ?? "",
    logo: s.logo ?? undefined,
    badge: s.badge ?? undefined,
    menu: s.menu ?? [],
  };

  const topics = faqTopics(snapshot);

  const profiles = snapshot.website_profiles.toSorted(bySort).map((p): Profile => ({
    id: p.id,
    name: p.name,
    title: p.title ?? "",
    bio: p.bio ?? "",
    photo: p.photo ?? undefined,
    groups: p.groups ?? [],
  }));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const programRows = snapshot.website_programs.filter((p) => p.status === "published").toSorted(bySort);
  const programById = new Map(
    programRows.map((p): [Id, Program] => [
      p.id,
      {
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle ?? "",
        summary: p.summary ?? "",
        cardImage: p.card_image ?? undefined,
        banner: p.banner ?? undefined,
        body: p.body ?? "",
        registrationLabel: p.registration_label ?? "",
        registrationUrl: p.registration_url ?? undefined,
        gallery: snapshot.website_programs_files
          .filter((f) => f.program_id === p.id)
          .toSorted(bySort)
          .map((f) => f.file_id),
      },
    ]),
  );

  const categories = snapshot.website_categories.toSorted(bySort).map((c): Category => ({
    slug: c.slug,
    title: c.title,
    summary: c.summary ?? "",
    status: c.status,
    image: c.image ?? undefined,
    banner: c.banner ?? undefined,
    top: c.top ?? "",
    bottom: c.bottom ?? "",
    testimonial: c.testimonial ?? "",
    programs: linked(snapshot.website_categories_programs, "category_id", "program_id", c.id, programById),
    faqTopics: linked(snapshot.website_categories_faq_topics, "category_id", "topic_id", c.id, topics),
    profiles: linked(snapshot.website_categories_profiles, "category_id", "profile_id", c.id, profileById),
    gallery: snapshot.website_categories_files
      .filter((f) => f.category_id === c.id)
      .toSorted(bySort)
      .map((f) => f.file_id),
  }));

  const pages = snapshot.website_pages.map((p): Page => ({
    slug: p.slug,
    title: p.title,
    description: p.description ?? "",
    banner: p.banner ?? undefined,
    image: p.image ?? undefined,
    body: p.body ?? "",
    action: action(p.action_label, p.action_url),
    sections: snapshot.website_page_sections
      .filter((x) => x.page_id === p.id)
      .toSorted(bySort)
      .map((x) => ({
        title: x.title,
        image: x.image ?? undefined,
        body: x.body ?? "",
        action: action(x.action_label, x.action_url),
      })),
    faqTopics: linked(snapshot.website_pages_faq_topics, "page_id", "topic_id", p.id, topics),
  }));

  const policies = snapshot.website_policies.toSorted(bySort).map((p): Policy => ({
    slug: p.slug,
    title: p.title,
    inFooter: p.in_footer,
    versions: snapshot.website_policy_versions
      .filter((v) => v.policy_id === p.id)
      .map((v) => ({ title: v.title, effective: v.effective, body: v.body ?? "" }))
      .toSorted((a, b) => a.effective.localeCompare(b.effective)),
  }));

  const sponsorLevels = snapshot.website_sponsor_levels
    .toSorted(bySort)
    .map((l): SponsorLevel => ({ name: l.name, amountCents: l.amount_cents, benefits: l.benefits ?? "" }));
  const levelName = new Map(snapshot.website_sponsor_levels.map((l) => [l.id, l.name]));
  const sponsors = snapshot.website_sponsors.toSorted(bySort).map((r): Sponsor => ({
    name: r.name,
    url: r.url ?? undefined,
    logo: r.logo ?? undefined,
    level: r.level_id ? levelName.get(r.level_id) : undefined,
  }));

  const files = snapshot.files.map((f): File => ({
    id: f.id,
    filename: f.filename_download,
    type: f.type ?? "",
    alt: f.description ?? "",
  }));

  return {
    settings,
    pages,
    categories,
    programs: [...programById.values()],
    profiles,
    policies,
    sponsorLevels,
    sponsors,
    files,
  };
}
