import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, ".."),
  site = path.join(root, "site"),
  html = fs.readFileSync(path.join(site, "index.html"), "utf8");
const sources = fs
  .readdirSync(path.join(site, "assets"))
  .filter((name) => name.endsWith(".js") && !name.startsWith("pdf."))
  .map((name) => path.join(site, "assets", name));
for (const dir of ["scripts", "tests", "site/benchmark"]) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    if (/\.(?:js|mjs|cjs)$/.test(name)) sources.push(path.join(root, dir, name));
  }
}
let failed = false;
let trackedFiles;
const checkedTrackedFiles = new Set();
if (fs.existsSync(path.join(root, ".git"))) {
  const tracked = spawnSync("git", ["ls-files", "--cached", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (tracked.status === 0) trackedFiles = new Set(tracked.stdout.split("\0"));
  else {
    console.error("Could not inspect files included in Git.");
    failed = true;
  }
}
function checkTracked(file) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (checkedTrackedFiles.has(relative)) return;
  checkedTrackedFiles.add(relative);
  if (trackedFiles && !trackedFiles.has(relative)) {
    console.error("File missing from Git: " + relative);
    failed = true;
  }
}
for (const file of sources) {
  checkTracked(file);
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status) {
    process.stderr.write(check.stderr);
    failed = true;
  }
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length) {
  console.error("Duplicate HTML IDs.");
  failed = true;
}
function checkAsset(asset) {
  if (/^(https?:|data:)/.test(asset)) return;
  const file = path.join(site, asset);
  if (!fs.existsSync(file)) {
    console.error("Missing asset: " + asset);
    failed = true;
  } else checkTracked(file);
}
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) checkAsset(match[1]);
for (const name of [
  "xmlEditor",
  "xmlStats",
  "headerImportButton",
  "reportBugButton",
  "mobileSourceButton",
  "mobileDocumentButton",
])
  if (!ids.includes(name)) {
    console.error("Missing control: " + name);
    failed = true;
  }
const appSources = sources
  .filter((file) => file.startsWith(path.join(site, "assets")))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
for (const match of appSources.matchAll(/loadScript\(["']([^"']+)["']\)/g))
  checkAsset(match[1]);
checkAsset("assets/vendor/JSZIP-LICENSE.txt");
const dynamicIds = [
  ...appSources.matchAll(/\bid=["']([\w-]+)["']|\.id\s*=\s*["']([\w-]+)["']/g),
].map((match) => match[1] || match[2]);
const knownIds = new Set([...ids, ...dynamicIds]);
for (const match of appSources.matchAll(/\$\(["']#([\w-]+)["']\)/g)) {
  if (!knownIds.has(match[1])) {
    console.error("Unknown control: " + match[1]);
    failed = true;
  }
}
if (!html.includes("<title>Résumé 2.0</title>")) failed = true;
if (/Maya|Samira|single column|two columns/.test(html)) {
  console.error("Unexpected example data in interface.");
  failed = true;
}
if (failed) process.exit(1);
console.log("JavaScript syntax, unique controls, release files, local assets and branding passed.");
