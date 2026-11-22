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

/** One crew member's card in one list: their name, and the positions they hold that the list shows. */
export interface Profile {
  id: Id;
  name: string;
  title: string;
  bio: string;
  photo: Id | undefined;
}

/** A list on Our Crew, such as Instructors. */
export interface CrewList {
  id: Id;
  title: string;
  profiles: Profile[];
}

/** One offering on sale, as a program page lists it. */
export interface DateRow {
  /** The program's name on a page covering several programs, otherwise the offering's, such as Week 3. */
  label: string;
  startsOn: string | null;
  endsOn: string | null;
  priceCents: number | null;
  /** Such as "3 spots left", shown only when few are left, or empty. */
  spots: string;
}

/** A program's offerings on one registration form, such as 2027 Summer Sailing Camps. */
export interface DateGroup {
  form: string;
  /** Its Clubspot camp's sign-up page, while the camp is public and takes registrations. */
  registerUrl: string | undefined;
  /** When registration opens, as `YYYY-MM-DD`, while it hasn't. */
  opensOn: string | undefined;
  rows: DateRow[];
}

/**
 * Where a program's registration stands, from its offerings: open when a camp takes registrations, coming when
 * offerings are on sale but none takes them yet, and none when nothing is coming up.
 */
export type Registration = "open" | "coming" | "none";

export interface Program {
  slug: string;
  title: string;
  subtitle: string;
  /** Such as "Ages 6–8", from the catalog programs the page covers, or empty. */
  ages: string;
  summary: string;
  cardImage: Id | undefined;
  banner: Id | undefined;
  body: string;
  dates: DateGroup[];
  registration: Registration;
  gallery: Id[];
}

export interface Category {
  slug: string;
  title: string;
  summary: string;
  /** Staff's status, as its programs leave it (`categoryStatus`). */
  status: Status;
  /** When its programs' registration opens, while none takes it yet. */
  opensOn: string | undefined;
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
  crewLists: CrewList[];
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

/** The name the site shows: the first name, or first and last when staff chose to show both. */
export function crewName(person: { first_name: string | null; last_name: string | null }, full: boolean): string {
  const first = person.first_name?.trim() ?? "";
  const last = person.last_name?.trim() ?? "";
  return full && last ? `${first} ${last}` : first;
}

/**
 * Each list on Our Crew, in order: for each of its positions in turn, the crew members in it on `today`, by the name
 * shown. Someone in two of a list's positions is one card, at the first, with both titles.
 */
export function crewLists(
  snapshot: Pick<
    Snapshot,
    | "website_crew_sections"
    | "website_crew_sections_positions"
    | "crew_members"
    | "crew_terms"
    | "crew_positions"
    | "people"
  >,
  today: string,
): CrewList[] {
  const people = new Map(snapshot.people.map((p) => [p.id, p]));
  const positions = new Map(snapshot.crew_positions.map((p) => [p.id, p.name]));
  const members = new Map(snapshot.crew_members.map((m) => [m.id, m]));
  const current = snapshot.crew_terms.filter(
    (t) => (t.starts_on === null || t.starts_on <= today) && (t.ends_on === null || t.ends_on >= today),
  );
  return snapshot.website_crew_sections.toSorted(bySort).map((section): CrewList => {
    const cards = new Map<Id, Profile>();
    for (const link of snapshot.website_crew_sections_positions
      .filter((l) => l.section_id === section.id)
      .toSorted(bySort)) {
      const title = positions.get(link.position_id);
      if (title === undefined) continue;
      const holders = current
        .filter((t) => t.position_id === link.position_id)
        .flatMap((t) => {
          const member = members.get(t.crew_member_id);
          const person = member && people.get(member.person_id);
          const name = member && person ? crewName(person, member.show_full_name) : "";
          return member && name ? [{ member, name }] : [];
        })
        .toSorted((a, b) => a.name.localeCompare(b.name));
      for (const { member, name } of holders) {
        const card = cards.get(member.id);
        if (card) {
          if (!card.title.split(", ").includes(title)) card.title = `${card.title}, ${title}`;
          continue;
        }
        cards.set(member.id, {
          id: member.id,
          name,
          title,
          bio: member.website_bio ?? "",
          photo: member.website_photo ?? undefined,
        });
      }
    }
    return { id: section.id, title: section.title, profiles: [...cards.values()] };
  });
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
 * Where a program's main button goes. A program taking registrations sends it to Clubspot, and one whose offerings
 * aren't open yet to the newsletter. A program with nothing coming up follows its category: coming soon sends it to
 * the newsletter, and otherwise it goes to the program's own page.
 */
export function programAction(program: Program, status: Status): Action {
  const open = program.dates.find((group) => group.registerUrl !== undefined);
  if (open?.registerUrl) return { label: "Register", href: open.registerUrl };
  if (program.registration === "coming" || (program.registration === "none" && status === "coming_soon"))
    return { label: "Get Notified", href: "/newsletter" };
  return { label: "Learn More", href: `/program/${program.slug}` };
}

/** A category's status, as its programs leave it: open when one takes registrations, coming soon when all wait. */
export function categoryStatus(status: Status, programs: Program[]): Status {
  if (programs.some((p) => p.registration === "open")) return "open";
  if (programs.length > 0 && programs.every((p) => p.registration === "coming")) return "coming_soon";
  return status;
}

/** "Ages 6–8", "Ages 18 and up", "Up to age 12", or empty, from the youngest and oldest a program takes. */
export function ages(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
  if (min !== null) return `Ages ${min} and up`;
  if (max !== null) return `Up to age ${max}`;
  return "";
}

/** "3 spots left" at 5 or fewer, "Full. Join the waitlist." at none, and otherwise nothing, so a page doesn't go stale. */
export function spotsLeft(capacity: number | null, confirmed: number, hidden: boolean): string {
  if (hidden || capacity === null) return "";
  const left = capacity - confirmed;
  if (left <= 0) return "Full. Join the waitlist.";
  if (left === 1) return "1 spot left";
  return left <= 5 ? `${left} spots left` : "";
}

const clubspot = (campId: string) => `https://theclubspot.com/register/camp/${campId}/class`;

/**
 * The offerings a page covering `programIds` shows, not over by `today`, grouped by their registration form in the
 * order they start, each row by the day it starts.
 */
export function programDates(
  snapshot: Pick<Snapshot, "programs" | "offerings" | "registration_forms" | "clubspot_camps">,
  programIds: Id[],
  today: string,
): DateGroup[] {
  const several = programIds.length > 1;
  const programName = new Map(snapshot.programs.map((p) => [p.id, p.name]));
  const forms = new Map(snapshot.registration_forms.map((f) => [f.id, f]));
  const camps = new Map(snapshot.clubspot_camps.map((c) => [c.id, c]));
  const offerings = snapshot.offerings
    .filter((o) => programIds.includes(o.program_id) && (o.ends_on === null || o.ends_on >= today))
    .toSorted((a, b) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""));
  const groups = new Map<string, DateGroup>();
  for (const o of offerings) {
    const form = o.registration_form_id ? forms.get(o.registration_form_id) : undefined;
    if (form === undefined) continue;
    const camp = form.clubspot_camp_id ? camps.get(form.clubspot_camp_id) : undefined;
    let group = groups.get(form.id);
    if (group === undefined) {
      group = {
        form: form.name,
        registerUrl: camp && !camp.registration_closed ? clubspot(camp.id) : undefined,
        opensOn: form.opens_on && form.opens_on > today ? form.opens_on : undefined,
        rows: [],
      };
      groups.set(form.id, group);
    }
    group.rows.push({
      label: (several ? programName.get(o.program_id) : o.name) ?? o.name ?? "",
      startsOn: o.starts_on,
      endsOn: o.ends_on,
      priceCents: o.price_cents,
      spots: camp ? spotsLeft(o.capacity, o.confirmed_count, camp.hide_spots_left) : "",
    });
  }
  return [...groups.values()];
}

const shortDay = (date: string, withYear: boolean) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  });

/** "Jun 21–25", "Jun 28 – Jul 2", or "Dec 1, 2026 – Feb 28, 2027" when it crosses a year. */
export function dayRange(from: string | null, to: string | null): string {
  if (from === null || to === null) return from ? shortDay(from, true) : to ? shortDay(to, true) : "";
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${shortDay(from, true)} – ${shortDay(to, true)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${shortDay(from, false)}–${Number(to.slice(8))}`;
  return `${shortDay(from, false)} – ${shortDay(to, false)}`;
}

/** "February 22, 2027". */
export const longDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** A card's line: the first and last day of what's coming, and the price, "from" the lowest when they differ. */
export function datesSummary(program: Program): string {
  const rows = program.dates.flatMap((g) => g.rows);
  if (rows.length === 0) return "";
  const starts = rows
    .map((r) => r.startsOn)
    .filter((d) => d !== null)
    .sort();
  const ends = rows
    .map((r) => r.endsOn)
    .filter((d) => d !== null)
    .sort();
  const prices = [...new Set(rows.map((r) => r.priceCents).filter((c) => c !== null))].sort((a, b) => a - b);
  const span = dayRange(starts[0] ?? null, ends.at(-1) ?? null);
  const price = prices.length === 0 ? "" : prices.length === 1 ? dollars(prices[0]!) : `from ${dollars(prices[0]!)}`;
  return [span, price].filter(Boolean).join(" · ");
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

export function buildContent(snapshot: Snapshot, today: string): Content {
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

  const lists = crewLists(snapshot, today);
  const listById = new Map(lists.map((l) => [l.id, l]));

  const programRows = snapshot.website_programs.filter((p) => p.status === "published").toSorted(bySort);
  const catalog = new Map(snapshot.programs.map((p) => [p.id, p]));
  const programById = new Map(
    programRows.map((p): [Id, Program] => {
      const covered = snapshot.website_programs_catalog_programs
        .filter((l) => l.website_program_id === p.id)
        .toSorted(bySort)
        .map((l) => catalog.get(l.catalog_program_id))
        .filter((c) => c !== undefined);
      const mins = covered.map((c) => c.min_age).filter((a) => a !== null);
      const maxes = covered.map((c) => c.max_age).filter((a) => a !== null);
      const dates = programDates(
        snapshot,
        covered.map((c) => c.id),
        today,
      );
      const registration: Registration = dates.some((g) => g.registerUrl)
        ? "open"
        : dates.length > 0
          ? "coming"
          : "none";
      return [
        p.id,
        {
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle ?? "",
          ages: ages(mins.length > 0 ? Math.min(...mins) : null, maxes.length > 0 ? Math.max(...maxes) : null),
          summary: p.summary ?? "",
          cardImage: p.card_image ?? undefined,
          banner: p.banner ?? undefined,
          body: p.body ?? "",
          dates,
          registration,
          gallery: snapshot.website_programs_files
            .filter((f) => f.program_id === p.id)
            .toSorted(bySort)
            .map((f) => f.file_id),
        },
      ];
    }),
  );

  const categories = snapshot.website_categories.toSorted(bySort).map((c): Category => {
    const listed = linked(snapshot.website_categories_programs, "category_id", "program_id", c.id, programById);
    const status = categoryStatus(c.status, listed);
    return {
      slug: c.slug,
      title: c.title,
      summary: c.summary ?? "",
      status,
      opensOn:
        status === "coming_soon"
          ? listed
              .flatMap((p) => p.dates.map((g) => g.opensOn))
              .filter(Boolean)
              .sort()[0]
          : undefined,
      image: c.image ?? undefined,
      banner: c.banner ?? undefined,
      top: c.top ?? "",
      bottom: c.bottom ?? "",
      testimonial: c.testimonial ?? "",
      programs: listed,
      faqTopics: linked(snapshot.website_categories_faq_topics, "category_id", "topic_id", c.id, topics),
      profiles: (c.crew_section_id && listById.get(c.crew_section_id)?.profiles) || [],
      gallery: snapshot.website_categories_files
        .filter((f) => f.category_id === c.id)
        .toSorted(bySort)
        .map((f) => f.file_id),
    };
  });

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
    crewLists: lists,
    policies,
    sponsorLevels,
    sponsors,
    files,
  };
}
