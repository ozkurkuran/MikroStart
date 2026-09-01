import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const target = process.argv[2] ?? "newtab";
if (!new Set(["newtab", "dashboard"]).has(target)) {
  throw new Error(`Unknown validation target: ${target}`);
}

const distDirectory = resolve("dist");
const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(distDirectory, "manifest.json"), "utf8"));
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return undefined;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

check(manifest.manifest_version === 3, "manifest_version must be 3.");
check(manifest.version === packageJson.version, "Manifest and package versions must match.");
check(typeof manifest.name === "string" && manifest.name.length <= 75, "Manifest name must be at most 75 characters.");
check(typeof manifest.description === "string" && manifest.description.length <= 132, "Manifest description must be at most 132 characters.");
check(manifest.background?.type === "module", "The service worker must be declared as a module.");
check(manifest.content_security_policy?.extension_pages === "script-src 'self'; object-src 'self';", "Extension CSP must allow packaged scripts only.");
check(manifest.optional_host_permissions?.length === 1 && manifest.optional_host_permissions[0] === "https://*/*", "Host access must remain optional and HTTPS-only.");
check(!("host_permissions" in manifest), "Required host permissions are not allowed.");
check(target === "newtab" ? manifest.chrome_url_overrides?.newtab === "pages/newtab.html" : !("chrome_url_overrides" in manifest), "URL override does not match the selected build target.");

const files = await listFiles(distDirectory);
check(files.includes("manifest.json"), "manifest.json must be at the package root.");
check(!files.some((file) => file.endsWith(".map")), "Production packages must not contain source maps.");

for (const size of [16, 32, 48, 128]) {
  const iconPath = `icons/icon-${size}.png`;
  check(manifest.icons?.[size] === iconPath, `Manifest icon ${size} is missing.`);
  check(manifest.action?.default_icon?.[size] === iconPath, `Action icon ${size} is missing.`);
  if (files.includes(iconPath)) {
    const dimensions = pngDimensions(await readFile(join(distDirectory, ...iconPath.split("/"))));
    check(dimensions?.width === size && dimensions?.height === size, `${iconPath} must be ${size}x${size} PNG.`);
  } else {
    errors.push(`${iconPath} is missing from the package.`);
  }
}

for (const file of files.filter((entry) => extname(entry) === ".html")) {
  const html = await readFile(join(distDirectory, ...file.split("/")), "utf8");
  check(!/<script\b[^>]*\bsrc=["']https?:/i.test(html), `${file} loads a remote script.`);
  check(!/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html), `${file} contains inline executable script.`);
}

for (const file of files) {
  const info = await stat(join(distDirectory, ...file.split("/")));
  check(info.size <= 20 * 1024 * 1024, `${file} exceeds the 20 MiB per-file review guardrail.`);
}

if (errors.length) {
  throw new Error(`Chrome package validation failed:\n- ${errors.join("\n- ")}`);
}

console.log(`Validated ${target} Chrome package (${files.length} files, manifest v${manifest.version}).`);
