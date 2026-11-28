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
  /** Such as "3 spots left", or empty when Clubspot doesn't say. */
  spots: string;
  /** How many spots are left, 0 when it's full, or null when Clubspot doesn't say. */
  left: number | null;
  /** The catalog product it sells, so a program's several offerings, such as classes, can be told apart from one season. */
  product: Id;
  /** The weekdays it meets, Monday first. */
  schedule: Meeting[];
}

/** One weekday an offering meets, from its schedule. */
export interface Meeting {
  /** 1 is Monday, 7 is Sunday. */
  weekday: number;
  /** Such as "16:15". */
  startTime: string;
  endTime: string;
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
 * Where a program's registration stands, from its offerings: open when a camp takes registrations, coming when an
 * offering that hasn't started yet isn't taking them yet, and none otherwise, such as a season already under way.
 */
export type Registration = "open" | "coming" | "none";

export interface Program {
  slug: string;
  title: string;
  subtitle: string;
  /** Such as "Ages 6–8", from the catalog programs the page covers, or empty. */
  ages: string;
  /** The youngest and oldest the catalog programs it covers take, for its group's ages. */
  minAge: number | null;
  maxAge: number | null;
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
  /** Its programs in their sections, in order. Programs in no section of this page are a last group with no title. */
  groups: ProgramGroup[];
  faqTopics: FaqTopic[];
  profiles: Profile[];
  gallery: Id[];
}

/** A section of a category's page, such as Youth Sailing, with its programs. */
export interface ProgramGroup {
  /** Empty for the programs in no section. */
  title: string;
  /** Such as "Ages 8–12", from its programs' ages, never from the group itself. */
  ages: string;
  programs: Program[];
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

/**
 * How many spots are left, or null when Clubspot hides them or there's no limit. The site republishes when offerings
 * change (cyc-seattle/platform#350), so it shows every count, not only a low one.
 */
export function left(capacity: number | null, confirmed: number, hidden: boolean): number | null {
  return hidden || capacity === null ? null : Math.max(capacity - confirmed, 0);
}

/** "3 spots left", "1 spot left", "Full. Join the waitlist." at none, or nothing when the count isn't known. */
export function spotsLeft(capacity: number | null, confirmed: number, hidden: boolean): string {
  const n = left(capacity, confirmed, hidden);
  if (n === null) return "";
  if (n === 0) return "Full. Join the waitlist.";
  return n === 1 ? "1 spot left" : `${n} spots left`;
}

const clubspot = (campId: string) => `https://theclubspot.com/register/camp/${campId}/class`;

/**
 * The offerings a page covering `programIds` shows, dated and not over by `today`, grouped by their registration form in the
 * order they start, each row by the day it starts.
 */
export function programDates(
  snapshot: Pick<Snapshot, "programs" | "offerings" | "offering_schedule" | "registration_forms" | "clubspot_camps">,
  programIds: Id[],
  today: string,
): DateGroup[] {
  const several = programIds.length > 1;
  // An offering belongs to a product, and a product is one program at most.
  const programName = new Map(snapshot.programs.map((p) => [p.product_id, p.name]));
  const productIds = snapshot.programs.filter((p) => programIds.includes(p.id)).map((p) => p.product_id);
  const forms = new Map(snapshot.registration_forms.map((f) => [f.id, f]));
  const camps = new Map(snapshot.clubspot_camps.map((c) => [c.id, c]));
  const offerings = snapshot.offerings
    // One with no end date, such as an old season Clubspot never dated, can't be shown as coming up.
    .filter((o) => productIds.includes(o.product_id) && o.ends_on !== null && o.ends_on >= today)
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
      label: (several ? programName.get(o.product_id) : o.name) ?? o.name ?? "",
      startsOn: o.starts_on,
      endsOn: o.ends_on,
      priceCents: o.price_cents,
      spots: camp ? spotsLeft(o.capacity, o.confirmed_count, camp.hide_spots_left) : "",
      left: camp ? left(o.capacity, o.confirmed_count, camp.hide_spots_left) : null,
      product: o.product_id,
      schedule: snapshot.offering_schedule
        .filter((m) => m.offering_id === o.id)
        .map((m) => ({ weekday: m.weekday, startTime: m.start_time.slice(0, 5), endTime: m.end_time.slice(0, 5) }))
        .toSorted((a, b) => a.weekday - b.weekday),
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

/** A week a category's camps run in: one column of its schedule. */
export interface Week {
  startsOn: string;
  endsOn: string;
}

/** A category's camps by week: one row per program, with its offering in each week, or none that week. */
export interface WeekSchedule {
  weeks: Week[];
  rows: { program: Program; cells: (DateRow | undefined)[] }[];
}

const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

/** The weeks every dated offering of the programs runs in, when each is a week or less; none otherwise. */
export function scheduleWeeks(programs: Program[]): Week[] | undefined {
  const all = programs.flatMap((p) => p.dates.flatMap((g) => g.rows)).filter((r) => r.startsOn && r.endsOn);
  if (all.length === 0 || all.some((r) => days(r.startsOn!, r.endsOn!) > 6)) return undefined;
  return [...new Map(all.map((r) => [r.startsOn!, { startsOn: r.startsOn!, endsOn: r.endsOn! }])).values()].sort(
    (a, b) => a.startsOn.localeCompare(b.startsOn),
  );
}

/**
 * The programs' offerings by week, when every dated offering is a week or less, as summer camps are. A program with
 * no offerings has no row. There's none for programs that sell longer offerings, such as a race team's season.
 * `weeks` gives every group on a category's page the same columns, the category's weeks.
 */
export function weekSchedule(programs: Program[], weeks = scheduleWeeks(programs)): WeekSchedule | undefined {
  if (weeks === undefined || scheduleWeeks(programs) === undefined) return undefined;
  const rows = programs.map((program) => ({
    program,
    rows: program.dates.flatMap((g) => g.rows).filter((r) => r.startsOn !== null && r.endsOn !== null),
  }));
  return {
    weeks,
    rows: rows
      .filter((d) => d.rows.length > 0)
      .map(({ program, rows }) => ({ program, cells: weeks.map((w) => rows.find((r) => r.startsOn === w.startsOn)) })),
  };
}

/** The weeks in each month, by the month each week starts in, such as June's two weeks. */
export function weeksByMonth(weeks: Week[]): { month: string; weeks: Week[] }[] {
  const months: { month: string; weeks: Week[] }[] = [];
  for (const week of weeks) {
    const month = new Date(`${week.startsOn}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
    if (months.at(-1)?.month === month) months.at(-1)!.weeks.push(week);
    else months.push({ month, weeks: [week] });
  }
  return months;
}

/** A week's days, such as "21–25", or "28–2" for one that runs into the next month. */
export const weekDays = (week: Week) => `${Number(week.startsOn.slice(8))}–${Number(week.endsOn.slice(8))}`;

/** A week's cell: "3 left", "Full", or nothing when Clubspot doesn't say yet. */
export function weekSpots(row: DateRow): string {
  if (row.left === null) return "";
  return row.left === 0 ? "Full" : `${row.left} left`;
}

/** What a program's weeks cost, such as "$675 a week", or "from $650 a week" when they differ. */
export function weekPrice(program: Program): string {
  const prices = [
    ...new Set(
      program.dates
        .flatMap((g) => g.rows)
        .map((r) => r.priceCents)
        .filter((c) => c !== null),
    ),
  ].sort((a, b) => a - b);
  if (prices.length === 0) return "";
  return `${prices.length > 1 ? "from " : ""}${dollars(prices[0]!)} a week`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const EVERY = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"] as const;

/** A clock time with no am or pm, as a day cell shows it: "4:15", "9", "12", "1:30". */
export function clock(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}` : `${hour}:${String(m).padStart(2, "0")}`;
}

/** A meeting's times, such as ["4:15", "7:30"]; a cell joins them with a dash it may break after. */
export const meetingTimes = (m: Meeting): [string, string] => [clock(m.startTime), clock(m.endTime)];

/** The kind of class an offering is, by the weekdays it meets: "Tue & Thu", "Wednesdays", "Mon, Wed & Fri". */
export function classKind(schedule: Meeting[]): string {
  const days = schedule.map((m) => WEEKDAYS[m.weekday - 1]!);
  if (days.length === 1) return EVERY[schedule[0]!.weekday - 1]!;
  return days.length === 2 ? days.join(" & ") : `${days.slice(0, -1).join(", ")} & ${days.at(-1)}`;
}

/** A month a group's classes start in, as "2027-05". */
export type Month = string;

/** One kind of class of one program, with its classes by the month each starts in. */
export interface ClassRow {
  program: Program;
  kind: string;
  /** The classes starting in each of the calendar's months, in its order. */
  cells: DateRow[][];
}

/** A group's classes by month, when one of its programs sells several dated classes, as Adult Learn to Sail does. */
export interface ClassCalendar {
  months: Month[];
  rows: ClassRow[];
}

const monthOf = (date: string): Month => date.slice(0, 7);

/**
 * A group's classes as a month calendar: one row per program and kind of class, Tue & Thu (or Wednesdays) before
 * Sat & Sun, and each class in the month it starts. Every month from the first class to the last is a column, so a
 * month with no class of a kind shows as empty. None unless some program sells several classes with a schedule.
 */
export function classCalendar(programs: Program[]): ClassCalendar | undefined {
  const rows = programs.flatMap((program) =>
    program.dates
      .flatMap((g) => g.rows)
      .filter((row) => row.schedule.length > 0 && row.startsOn !== null)
      .map((row) => ({ program, row })),
  );
  const perProduct = new Map<Id, number>();
  for (const { row } of rows) perProduct.set(row.product, (perProduct.get(row.product) ?? 0) + 1);
  if (![...perProduct.values()].some((n) => n > 1)) return undefined;
  const starts = rows.map(({ row }) => monthOf(row.startsOn!)).sort();
  const months: Month[] = [];
  for (let m = starts[0]!; m <= starts.at(-1)!;) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number) as [number, number];
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const first = (row: DateRow) => row.schedule[0]!.weekday;
  return {
    months,
    rows: programs.flatMap((program) => {
      const mine = rows.filter((r) => r.program === program).map((r) => r.row);
      const kinds = [
        ...new Map(mine.toSorted((a, b) => first(a) - first(b)).map((r) => [classKind(r.schedule), r])).keys(),
      ];
      return kinds.map((kind): ClassRow => ({
        program,
        kind,
        cells: months.map((m) => mine.filter((r) => classKind(r.schedule) === kind && monthOf(r.startsOn!) === m)),
      }));
    }),
  };
}

/** A month's short name, such as "May", for a calendar's columns. */
export const monthName = (month: Month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

/** A group's ages: from its youngest program's youngest to its oldest program's oldest. */
export function groupAges(programs: Program[]): string {
  const mins = programs.map((p) => p.minAge).filter((a) => a !== null);
  const maxes = programs.map((p) => p.maxAge).filter((a) => a !== null);
  return ages(mins.length > 0 ? Math.min(...mins) : null, maxes.length > 0 ? Math.max(...maxes) : null);
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
      const minAge = mins.length > 0 ? Math.min(...mins) : null;
      const maxAge = maxes.length > 0 ? Math.max(...maxes) : null;
      const dates = programDates(
        snapshot,
        covered.map((c) => c.id),
        today,
      );
      const registration: Registration = dates.some((g) => g.registerUrl)
        ? "open"
        : dates.some((g) => g.rows.some((r) => r.startsOn !== null && r.startsOn > today))
          ? "coming"
          : "none";
      return [
        p.id,
        {
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle ?? "",
          ages: ages(minAge, maxAge),
          minAge,
          maxAge,
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

  const groupOf = new Map(programRows.map((p) => [programById.get(p.id)!, p.group_id]));
  const categories = snapshot.website_categories.toSorted(bySort).map((c): Category => {
    const listed = linked(snapshot.website_categories_programs, "category_id", "program_id", c.id, programById);
    const sections = snapshot.website_program_groups.filter((g) => g.category_id === c.id).toSorted(bySort);
    const groups = [
      ...sections.map((g) => ({ title: g.title, programs: listed.filter((p) => groupOf.get(p) === g.id) })),
      { title: "", programs: listed.filter((p) => !sections.some((g) => g.id === groupOf.get(p))) },
    ]
      .filter((g) => g.programs.length > 0)
      .map((g): ProgramGroup => ({ ...g, ages: groupAges(g.programs) }));
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
      groups,
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
