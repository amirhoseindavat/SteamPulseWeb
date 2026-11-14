import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourceFiles = [
  "service-worker.js",
  "steam-store-button.js",
  "steam-sync.js",
  "steamdb-button.js",
  "steampulse-bridge.js"
];

const baseManifest = {
  manifest_version: 3,
  name: "SteamPulse Connect",
  version: "1.1.0",
  description: "Connects your signed-in Steam Store account to SteamPulse.",
  icons: { "16": "icons/icon48.png", "32": "icons/icon48.png", "48": "icons/icon48.png", "128": "icons/icon48.png" },
  action: { default_icon: { "16": "icons/icon48.png", "32": "icons/icon48.png" } },
  permissions: ["storage"],
  host_permissions: ["https://store.steampowered.com/*", "https://steamdb.info/*"],
  content_scripts: [
    { matches: ["https://store.steampowered.com/app/*"], js: ["steam-store-button.js"], run_at: "document_idle" },
    { matches: ["https://store.steampowered.com/*"], js: ["steam-sync.js"], run_at: "document_idle" },
    { matches: ["https://steamdb.info/app/*"], js: ["steamdb-button.js"], run_at: "document_idle" },
    { matches: ["https://steampulse.ir/*", "https://www.steampulse.ir/*", "http://localhost:5173/*", "http://127.0.0.1:5173/*"], js: ["steampulse-bridge.js"], run_at: "document_start" }
  ]
};

const builds = {
  chrome: { ...baseManifest, background: { service_worker: "service-worker.js" } },
  edge: { ...baseManifest, background: { service_worker: "service-worker.js" } },
  brave: { ...baseManifest, background: { service_worker: "service-worker.js" } },
  firefox: {
    ...baseManifest,
    browser_specific_settings: { gecko: { id: "connect@steampulse.ir", strict_min_version: "128.0" } },
    background: { scripts: ["service-worker.js"] }
  }
};

for (const [browser, manifest] of Object.entries(builds)) {
  const target = path.join(root, browser);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.join(target, "icons"), { recursive: true });

  for (const file of sourceFiles) {
    await cp(path.join(root, file), path.join(target, file));
  }

  await cp(path.join(root, "icons", "icon48.png"), path.join(target, "icons", "icon48.png"));
  await writeFile(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(target, "README.md"), `# SteamPulse Connect — ${browser}\n\nLoad this folder as an unpacked extension. See the parent extension/README.md for installation steps and privacy details.\n`);
  console.log(`Built extension/${browser}`);
}
