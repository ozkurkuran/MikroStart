import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2] ?? "newtab";

if (!new Set(["newtab", "dashboard"]).has(target)) {
  throw new Error(`Unknown build target: ${target}`);
}

const packageJson = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
);

const manifest = {
  manifest_version: 3,
  name: target === "newtab" ? "BenchTab" : "BenchTab Dashboard",
  short_name: "BenchTab",
  version: packageJson.version,
  description:
    "A local-first workbench for following, calculating, and recording experimental research.",
  minimum_chrome_version: "114",
  background: {
    service_worker: "assets/service-worker.js",
    type: "module",
  },
  permissions: ["storage", "alarms", "sidePanel", "offscreen"],
  optional_host_permissions: ["https://*/*"],
  action: {
    default_title: "Open BenchTab",
  },
  side_panel: {
    default_path: "pages/sidepanel.html",
  },
  options_page: "pages/options.html",
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
};

if (target === "newtab") {
  manifest.chrome_url_overrides = {
    newtab: "pages/newtab.html",
  };
}

await writeFile(
  resolve("dist", "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Generated ${target} manifest v${packageJson.version}`);
