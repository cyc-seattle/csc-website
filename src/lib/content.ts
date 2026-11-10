// The site's one source of content. `mise run pull` writes the snapshot to .content/ before every build, from
// Directus or from test/fixtures/, because Astro must find the pictures on disk to resize them. Pages import only
// this module.

import { readFileSync } from "node:fs";
import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import { buildContent, currentVersion, type Page, type Policy } from "./model.ts";
import { fileKind, snapshotFilename, type Snapshot } from "./snapshot.ts";

export * from "./model.ts";

const snapshot = JSON.parse(readFileSync(".content/content.json", "utf8")) as Snapshot;
const content = buildContent(snapshot);

export const { settings, pages, categories, programs, profiles, policies, sponsorLevels, sponsors } = content;

export function page(slug: string): Page {
  const found = pages.find((p) => p.slug === slug);
  if (!found) throw new Error(`The content has no page ${slug}.`);
  return found;
}

/** The first category that lists a program, for its status and breadcrumb. */
export const categoryOf = (slug: string) => categories.find((c) => c.programs.some((p) => p.slug === slug));

export const policyVersion = (policy: Policy) => currentVersion(policy, new Date().toISOString().slice(0, 10));

// --- Pictures ----------------------------------------------------------------------------------------------------

const modules = import.meta.glob<{ default: ImageMetadata }>("../../.content/files/*", { eager: true });
const metadata = new Map(Object.entries(modules).map(([path, m]) => [path.split("/").pop()!, m.default]));
const files = new Map(content.files.map((f) => [f.id, f]));

/** A picture's metadata for Astro's <Image>, and its description as alt text. */
export function image(id: string | undefined): { src: ImageMetadata; alt: string } | undefined {
  const file = id ? files.get(id) : undefined;
  const src = file && metadata.get(snapshotFilename(file.id, file.filename));
  return file && src ? { src, alt: file.alt } : undefined;
}

/**
 * The URL of a file that Markdown names by its ID. A picture is resized like any other. A video is copied as it is
 * into dist/media/ (astro.config.ts).
 */
export async function fileUrl(id: string): Promise<string> {
  const file = files.get(id);
  if (file && fileKind({ type: file.type, filename_download: file.filename }) === "video")
    return `/media/${snapshotFilename(file.id, file.filename)}`;
  const picture = image(id);
  if (picture) return (await getImage({ src: picture.src, width: 1280, format: "webp" })).src;
  throw new Error(`Markdown names file ${id}, which isn't a picture or video in the Website folder.`);
}
