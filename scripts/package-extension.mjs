import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

import { ZipArchive } from "archiver";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const artifactDirectory = resolve("artifacts");
const archiveName = `benchtab-v${packageJson.version}-chrome.zip`;
const archivePath = resolve(artifactDirectory, archiveName);
const checksumPath = `${archivePath}.sha256`;
const distDirectory = resolve("dist");
const archiveDate = new Date("2000-01-01T00:00:00.000Z");

async function listFiles(directory, prefix = "") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

await mkdir(artifactDirectory, { recursive: true });
await Promise.all([
  rm(archivePath, { force: true }),
  rm(checksumPath, { force: true }),
]);

const archive = new ZipArchive({ zlib: { level: 9 } });
const output = createWriteStream(archivePath, { flags: "wx" });
const writing = pipeline(archive, output);
for (const file of await listFiles(distDirectory)) {
  archive.append(await readFile(join(distDirectory, ...file.split("/"))), {
    name: file,
    date: archiveDate,
    mode: 0o644,
  });
}
await archive.finalize();
await writing;

const digest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
await writeFile(checksumPath, `${digest}  ${archiveName}\n`, "utf8");

console.log(`Created ${archivePath}`);
console.log(`SHA-256 ${digest}`);
