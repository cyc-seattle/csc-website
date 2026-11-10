// Writes the content snapshot to .content/: content.json, the pictures in files/, and the videos in media/, each
// named by snapshotFilename.
//
// CONTENT_SOURCE=fixtures (the default) copies test/fixtures/. CONTENT_SOURCE=directus reads DIRECTUS_URL as the
// Website Build user, with DIRECTUS_TOKEN. Its policy lets it read only the website_* collections and the Website
// folder's files (cyc-seattle/platform#150).

import { createWriteStream } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { createDirectus, readItems, readSingleton, rest, staticToken } from "@directus/sdk";
import {
  collections,
  fileKind,
  referencedFiles,
  snapshotFilename,
  type FileRow,
  type Snapshot,
} from "../src/lib/snapshot.ts";

const out = ".content";
const source = process.env["CONTENT_SOURCE"] ?? "fixtures";

if (source === "fixtures") {
  await rm(out, { recursive: true, force: true });
  await cp("test/fixtures", out, { recursive: true });
  console.log(`Copied test/fixtures to ${out}/.`);
} else if (source === "directus") {
  await pullDirectus();
} else {
  throw new Error(`CONTENT_SOURCE must be fixtures or directus, not ${source}.`);
}

async function pullDirectus() {
  const url = process.env["DIRECTUS_URL"];
  const token = process.env["DIRECTUS_TOKEN"];
  if (!url || !token) throw new Error("CONTENT_SOURCE=directus needs DIRECTUS_URL and DIRECTUS_TOKEN.");
  const client = createDirectus(url).with(staticToken(token)).with(rest());

  const snapshot: Record<string, unknown> = {};
  for (const name of collections) {
    snapshot[name] =
      name === "website_settings"
        ? await client.request(readSingleton(name))
        : await client.request(readItems(name, { limit: -1 }));
  }
  // Only the fields the Website Build user may read, and no filter: its policy already limits it to the Website
  // folder, and filtering on a field it can't read is refused.
  const files = await getData<(FileRow & { filesize: number | string | null })[]>(
    url,
    token,
    "files?limit=-1&fields=id,filename_download,type,title,description,filesize",
  );
  const types = Object.entries(Object.groupBy(files, (f) => f.type ?? "unknown")).map(
    ([t, fs]) => `${fs?.length} ${t}`,
  );
  console.log(`Directus returned ${files.length} files: ${types.join(", ") || "none"}.`);
  const missing = [...referencedFiles(snapshot as unknown as Snapshot)].filter((id) => !files.some((f) => f.id === id));
  if (missing.length > 0) {
    throw new Error(
      `The content names ${missing.length} files the build can't read, such as ${missing.slice(0, 3).join(", ")}.`,
    );
  }
  const pictures = files.filter((f) => fileKind(f) === "picture");
  const videos = files.filter((f) => fileKind(f) === "video");
  snapshot["files"] = [...pictures, ...videos].map(({ id, filename_download, type, title, description }) => ({
    id,
    filename_download,
    type,
    title,
    description,
  }));
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "content.json"), JSON.stringify(snapshot, null, 2));

  // Videos go in media/, which the build copies as they are, so Astro's picture import never sees them.
  const fetched = (await download(url, token, pictures, "files")) + (await download(url, token, videos, "media"));
  console.log(
    `Pulled ${collections.length} collections, ${pictures.length} pictures and ${videos.length} videos ` +
      `(${fetched} new) to ${out}/.`,
  );
}

/** Saves each file to .content/<dir>/, and deletes any there that Directus no longer has. Returns how many it fetched. */
async function download(
  url: string,
  token: string,
  files: (FileRow & { filesize: number | string | null })[],
  dir: string,
) {
  await mkdir(join(out, dir), { recursive: true });
  // Keeps a file the last pull saved when its size hasn't changed, so a build fetches only new or replaced files.
  const keep = new Set<string>();
  let fetched = 0;
  for (const f of files) {
    const name = snapshotFilename(f.id, f.filename_download);
    const path = join(out, dir, name);
    keep.add(name);
    const size = await stat(path).then(
      (s) => s.size,
      () => -1,
    );
    if (size === Number(f.filesize)) continue;
    const response = await fetch(new URL(`assets/${f.id}`, url.endsWith("/") ? url : `${url}/`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok || !response.body) throw new Error(`Couldn't download file ${f.id}: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body as ReadableStream), createWriteStream(path));
    fetched++;
  }
  for (const name of await readdir(join(out, dir))) {
    if (!keep.has(name)) await rm(join(out, dir, name));
  }
  return fetched;
}

/** GETs a Directus path and returns its data, or throws with Directus's own error messages. */
async function getData<T>(url: string, token: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, url.endsWith("/") ? url : `${url}/`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || body.errors || body.data === undefined) {
    throw new Error(`Directus refused ${path}: ${response.status} ${body.errors?.map((e) => e.message).join("; ")}`);
  }
  return body.data;
}
