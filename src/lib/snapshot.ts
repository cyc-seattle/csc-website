// The content snapshot: the website_* rows as Directus returns them, plus the Website folder's files.
// scripts/pull-content.ts writes it, from Directus or from test/fixtures/. Only the fields the site reads are typed.

export type Id = string;

export interface SettingsRow {
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  map_url: string | null;
  ein: string | null;
  social: { label: string; url: string }[] | null;
  announcement: string | null;
  logo: Id | null;
  badge: Id | null;
  menu: { label: string; items: { label: string; href: string }[] }[] | null;
}

export interface PageRow {
  id: Id;
  slug: string;
  title: string;
  description: string | null;
  banner: Id | null;
  image: Id | null;
  body: string | null;
  action_label: string | null;
  action_url: string | null;
}

export interface PageSectionRow {
  id: Id;
  page_id: Id;
  sort: number | null;
  title: string;
  image: Id | null;
  body: string | null;
  action_label: string | null;
  action_url: string | null;
}

export interface CategoryRow {
  id: Id;
  slug: string;
  title: string;
  summary: string | null;
  status: "open" | "closed" | "coming_soon";
  sort: number | null;
  image: Id | null;
  banner: Id | null;
  top: string | null;
  bottom: string | null;
  testimonial: string | null;
}

export interface ProgramRow {
  id: Id;
  slug: string;
  title: string;
  status: "published" | "hidden";
  sort: number | null;
  subtitle: string | null;
  summary: string | null;
  card_image: Id | null;
  banner: Id | null;
  body: string | null;
  registration_label: string | null;
  registration_url: string | null;
}

export interface FaqTopicRow {
  id: Id;
  title: string;
  heading: string | null;
}

export interface FaqRow {
  id: Id;
  topic_id: Id;
  sort: number | null;
  question: string;
  answer: string | null;
}

export interface ProfileRow {
  id: Id;
  name: string;
  title: string | null;
  sort: number | null;
  bio: string | null;
  photo: Id | null;
  groups: string[] | null;
}

export interface PolicyRow {
  id: Id;
  slug: string;
  title: string;
  sort: number | null;
  in_footer: boolean;
}

export interface PolicyVersionRow {
  id: Id;
  policy_id: Id;
  title: string;
  effective: string;
  body: string | null;
}

export interface SponsorLevelRow {
  id: Id;
  name: string;
  amount_cents: number;
  sort: number | null;
  benefits: string | null;
}

export interface SponsorRow {
  id: Id;
  name: string;
  url: string | null;
  logo: Id | null;
  level_id: Id | null;
  sort: number | null;
}

/** A row of a sorted many-to-many list. */
export type Link<A extends string, B extends string> = { [K in A | B]: Id } & { sort: number | null };

export interface FileRow {
  id: Id;
  filename_download: string;
  type: string | null;
  title: string | null;
  description: string | null;
}

export interface Snapshot {
  website_settings: SettingsRow;
  website_pages: PageRow[];
  website_page_sections: PageSectionRow[];
  website_pages_faq_topics: Link<"page_id", "topic_id">[];
  website_categories: CategoryRow[];
  website_categories_programs: Link<"category_id", "program_id">[];
  website_categories_faq_topics: Link<"category_id", "topic_id">[];
  website_categories_profiles: Link<"category_id", "profile_id">[];
  website_categories_files: Link<"category_id", "file_id">[];
  website_programs: ProgramRow[];
  website_programs_files: Link<"program_id", "file_id">[];
  website_faq_topics: FaqTopicRow[];
  website_faqs: FaqRow[];
  website_profiles: ProfileRow[];
  website_policies: PolicyRow[];
  website_policy_versions: PolicyVersionRow[];
  website_sponsor_levels: SponsorLevelRow[];
  website_sponsors: SponsorRow[];
  files: FileRow[];
}

/** The collections the pull reads, in the snapshot's order. website_settings is a singleton. */
export const collections = [
  "website_settings",
  "website_pages",
  "website_page_sections",
  "website_pages_faq_topics",
  "website_categories",
  "website_categories_programs",
  "website_categories_faq_topics",
  "website_categories_profiles",
  "website_categories_files",
  "website_programs",
  "website_programs_files",
  "website_faq_topics",
  "website_faqs",
  "website_profiles",
  "website_policies",
  "website_policy_versions",
  "website_sponsor_levels",
  "website_sponsors",
] as const satisfies readonly Exclude<keyof Snapshot, "files">[];

/** The name the pull saves a file under: its ID, with the extension it was uploaded with. */
export function snapshotFilename(id: Id, filenameDownload: string): string {
  const dot = filenameDownload.lastIndexOf(".");
  return dot > 0 ? id + filenameDownload.slice(dot).toLowerCase() : id;
}

const fileFields = new Set(["logo", "badge", "banner", "image", "card_image", "photo", "file_id"]);

/** Every file ID the content names in a picture field or a photo list. */
export function referencedFiles(snapshot: Omit<Snapshot, "files">): Set<Id> {
  const ids = new Set<Id>();
  for (const name of collections) {
    const rows: unknown = snapshot[name];
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      for (const [field, value] of Object.entries(row as Record<string, unknown>)) {
        if (fileFields.has(field) && typeof value === "string") ids.add(value);
      }
    }
  }
  return ids;
}

const extensions: Record<string, "picture" | "video"> = {
  jpg: "picture",
  jpeg: "picture",
  png: "picture",
  webp: "picture",
  gif: "picture",
  avif: "picture",
  svg: "picture",
  mp4: "video",
  webm: "video",
  mov: "video",
};

/**
 * Whether a file is a picture or a video. Directus stores application/octet-stream for a file uploaded without a
 * type, so a generic or missing type falls back to the file's extension.
 */
export function fileKind(file: Pick<FileRow, "type" | "filename_download">): "picture" | "video" | undefined {
  if (file.type?.startsWith("image/")) return "picture";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type && file.type !== "application/octet-stream") return undefined;
  return extensions[file.filename_download.split(".").pop()?.toLowerCase() ?? ""];
}
