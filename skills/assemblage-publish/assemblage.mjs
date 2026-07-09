#!/usr/bin/env node

// clients/skill/dist/cli.js
import { execSync } from "node:child_process";
import { createReadStream as createReadStream2, createWriteStream } from "node:fs";
import { mkdir, readFile as readFile2, stat as stat3, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname as dirname2, extname as extname2, join as join4, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// packages/protocol/dist/hash.js
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
async function hashFile(absPath) {
  const hash = createHash("sha256");
  await new Promise((resolve2, reject) => {
    createReadStream(absPath).on("data", (chunk) => hash.update(chunk)).on("end", resolve2).on("error", reject);
  });
  return hash.digest("hex");
}

// packages/protocol/dist/manifest.js
import { readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm"
};
function contentTypeFor(path) {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".svn", ".hg"]);
var SKIP_FILES = /* @__PURE__ */ new Set([".DS_Store", "Thumbs.db", "site.json"]);
async function buildManifest(root, opts = {}) {
  const manifest = {};
  await walk(root, root, manifest, opts);
  return manifest;
}
async function walk(root, dir, manifest, opts) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known")
      continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name))
        continue;
      await walk(root, abs, manifest, opts);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name))
        continue;
      const rel = relative(root, abs).split("\\").join("/");
      if (opts.filter && !opts.filter(rel))
        continue;
      const s = await stat(abs);
      manifest[rel] = {
        sha256: await hashFile(abs),
        size: s.size,
        contentType: contentTypeFor(rel)
      };
    }
  }
}
function diffManifests(from, to) {
  const added = [];
  const changed = [];
  const removed = [];
  const unchanged = [];
  for (const [path, entry] of Object.entries(to)) {
    const prev = from[path];
    if (!prev)
      added.push(path);
    else if (prev.sha256 !== entry.sha256)
      changed.push(path);
    else
      unchanged.push(path);
  }
  for (const path of Object.keys(from)) {
    if (!(path in to))
      removed.push(path);
  }
  return { added, changed, removed, unchanged };
}
function pathsByHash(manifest) {
  const map = /* @__PURE__ */ new Map();
  for (const [path, entry] of Object.entries(manifest)) {
    if (!map.has(entry.sha256))
      map.set(entry.sha256, { path, entry });
  }
  return map;
}

// packages/protocol/dist/resolve.js
import { readFile, access, stat as stat2 } from "node:fs/promises";
import { join as join2, resolve as resolvePath } from "node:path";
var OUTPUT_CANDIDATES = ["dist", "build", "public", "_site", "out"];
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
async function isDir(p) {
  try {
    return (await stat2(p)).isDirectory();
  } catch {
    return false;
  }
}
async function readJson(p) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return void 0;
  }
}
var FRAMEWORK_OUTPUT = [
  { dep: "vite", dir: "dist", label: "vite" },
  { dep: "astro", dir: "dist", label: "astro" },
  { dep: "next", dir: "out", label: "next (static export)" },
  { dep: "@11ty/eleventy", dir: "_site", label: "eleventy" }
];
async function detectPackageManager(root) {
  if (await exists(join2(root, "pnpm-lock.yaml")))
    return "pnpm";
  if (await exists(join2(root, "yarn.lock")))
    return "yarn";
  return "npm";
}
async function resolvePublish(root) {
  const abs = resolvePath(root);
  const config = await readJson(join2(abs, "site.json"));
  if (config && (config.dir || config.build)) {
    const dir = resolvePath(abs, config.dir ?? ".");
    return {
      dir,
      build: config.build,
      rule: "config",
      reason: config.build ? `Publishing ${config.dir ?? "."} after running "${config.build}" (site.json)` : `Publishing ${config.dir ?? "."} (site.json)`
    };
  }
  const pkg = await readJson(join2(abs, "package.json"));
  const rootIndex = await exists(join2(abs, "index.html"));
  if (!pkg && rootIndex) {
    return { dir: abs, rule: "root-index", reason: "Publishing the folder as-is (index.html at root)" };
  }
  if (pkg?.scripts?.build) {
    const pm = await detectPackageManager(abs);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const framework = FRAMEWORK_OUTPUT.find((f) => f.dep in deps);
    const outDir = framework?.dir ?? await firstOutputDirWithIndex(abs) ?? "dist";
    return {
      dir: resolvePath(abs, outDir),
      build: `${pm} run build`,
      rule: "build-script",
      reason: framework ? `Publishing ./${outDir} (built with ${framework.label})` : `Publishing ./${outDir} after running the build script`
    };
  }
  if (!rootIndex) {
    const outDir = await firstOutputDirWithIndex(abs);
    if (outDir) {
      return {
        dir: resolvePath(abs, outDir),
        rule: "output-dir",
        reason: `Publishing ./${outDir} (found index.html there, none at root)`
      };
    }
  }
  if (rootIndex) {
    return { dir: abs, rule: "root-index", reason: "Publishing the folder as-is (index.html at root)" };
  }
  throw new Error("Could not find anything to publish: no site.json, no index.html at the root, no build script, and no dist/build/public/_site/out directory containing index.html.");
}
async function firstOutputDirWithIndex(root) {
  for (const candidate of OUTPUT_CANDIDATES) {
    const dir = join2(root, candidate);
    if (await isDir(dir) && await exists(join2(dir, "index.html")))
      return candidate;
  }
  return void 0;
}

// clients/skill/dist/api.js
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join as join3 } from "node:path";
var DEFAULT_API_URL = "https://mjaanh7hnk.execute-api.us-east-1.amazonaws.com";
var CREDENTIALS_PATH = join3(homedir(), ".assemblage", "credentials.json");
function loadConfig() {
  const apiUrl = (process.env["ASSEMBLAGE_API_URL"] ?? DEFAULT_API_URL).replace(/\/$/, "");
  const envToken = process.env["ASSEMBLAGE_TOKEN"];
  if (envToken)
    return { apiUrl, token: envToken };
  try {
    const stored = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"));
    if (stored.token)
      return { apiUrl, token: stored.token };
  } catch {
  }
  const token = randomBytes(32).toString("base64url");
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify({ token }, null, 2));
  chmodSync(CREDENTIALS_PATH, 384);
  return { apiUrl, token };
}
var configFromEnv = loadConfig;
async function call(cfg, method, path, body) {
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      ...body ? { "content-type": "application/json" } : {}
    },
    body: body ? JSON.stringify(body) : void 0
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error ?? text;
    } catch {
    }
    throw new Error(`${method} ${path} \u2192 ${res.status}: ${message}`);
  }
  return await res.json();
}
var api = {
  createSite: (cfg, name) => call(cfg, "POST", "/sites", name ? { name } : {}),
  renameSite: (cfg, siteId, name) => call(cfg, "PATCH", `/sites/${siteId}`, { name }),
  listSites: (cfg) => call(cfg, "GET", "/sites"),
  createDeploy: (cfg, siteId, manifest) => call(cfg, "POST", `/sites/${siteId}/deploys`, { manifest }),
  finalize: (cfg, siteId, deployId) => call(cfg, "POST", `/sites/${siteId}/deploys/${deployId}/finalize`),
  publish: (cfg, siteId, deployId) => call(cfg, "POST", `/sites/${siteId}/publish`, { deployId }),
  getManifest: (cfg, siteId, deployId) => call(cfg, "GET", `/sites/${siteId}/deploys/${deployId}/manifest`),
  blobUrls: (cfg, hashes) => call(cfg, "POST", "/blobs/urls", { hashes }),
  requestEmailVerification: (cfg, email) => call(cfg, "POST", "/account/email", { email }),
  getAccount: (cfg) => call(cfg, "GET", "/account")
};

// clients/skill/dist/cli.js
function parseArgs(argv) {
  const [cmd = "help", ...rest] = argv;
  const positional = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      flags[key] = rest[++i];
    } else {
      positional.push(arg);
    }
  }
  return { cmd, positional, flags };
}
async function lastPublished(folder, siteId) {
  try {
    return JSON.parse(await readFile2(join4(folder, ".assemblage", `${siteId}.json`), "utf8"));
  } catch {
    return void 0;
  }
}
async function saveLastPublished(folder, siteId, manifest) {
  const dir = join4(folder, ".assemblage");
  await mkdir(dir, { recursive: true });
  await writeFile(join4(dir, `${siteId}.json`), JSON.stringify(manifest));
}
function fmtBytes(n) {
  if (n < 1024)
    return `${n} B`;
  if (n < 1024 ** 2)
    return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3)
    return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
async function preparedManifest(folder) {
  const plan = await resolvePublish(folder);
  if (plan.build) {
    console.log(`\u2192 ${plan.build}`);
    execSync(plan.build, { cwd: folder, stdio: "inherit" });
  }
  const manifest = await buildManifest(plan.dir);
  return { manifest, dir: plan.dir, note: plan.reason };
}
async function cmdStatus(folder, siteId) {
  const { manifest, note } = await preparedManifest(folder);
  console.log(note);
  const prev = await lastPublished(folder, siteId) ?? {};
  const d = diffManifests(prev, manifest);
  if (!d.added.length && !d.changed.length && !d.removed.length) {
    console.log("Nothing changed since last publish.");
    return;
  }
  for (const p of d.added)
    console.log(`  + ${p}`);
  for (const p of d.changed)
    console.log(`  ~ ${p}`);
  for (const p of d.removed)
    console.log(`  - ${p}`);
  const uploadBytes = [...d.added, ...d.changed].reduce((n, p) => n + (manifest[p]?.size ?? 0), 0);
  console.log(`${d.added.length} added, ${d.changed.length} changed, ${d.removed.length} removed \u2014 ~${fmtBytes(uploadBytes)} to upload`);
}
async function cmdPublish(folder, siteId) {
  const cfg = configFromEnv();
  const { manifest, dir, note } = await preparedManifest(folder);
  console.log(note);
  const { deployId, missing, uploadUrls } = await api.createDeploy(cfg, siteId, manifest);
  const byHash = pathsByHash(manifest);
  const uploadBytes = missing.reduce((n, h) => n + (byHash.get(h)?.entry.size ?? 0), 0);
  console.log(`${Object.keys(manifest).length} files; ${missing.length} blobs to upload (${fmtBytes(uploadBytes)})`);
  const CONCURRENCY = 6;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    await Promise.all(missing.slice(i, i + CONCURRENCY).map(async (hash) => {
      const found = byHash.get(hash);
      if (!found)
        throw new Error(`Manifest inconsistency for ${hash}`);
      const abs = join4(dir, found.path);
      const size = (await stat3(abs)).size;
      const init = {
        method: "PUT",
        headers: {
          "content-type": found.entry.contentType,
          "content-length": String(size),
          "x-amz-checksum-sha256": Buffer.from(hash, "hex").toString("base64")
        },
        body: Readable.toWeb(createReadStream2(abs)),
        duplex: "half"
        // required by node fetch for streamed bodies
      };
      const res = await fetch(uploadUrls[hash], init);
      if (!res.ok)
        throw new Error(`Upload failed for ${found.path}: ${res.status} ${await res.text()}`);
      console.log(`  \u2191 ${found.path} (${fmtBytes(size)})`);
    }));
  }
  const fin = await api.finalize(cfg, siteId, deployId);
  const pub = await api.publish(cfg, siteId, deployId);
  await saveLastPublished(folder, siteId, manifest);
  console.log(`Live: ${pub.liveUrl}`);
  console.log(`Preview: ${fin.previewUrl}`);
}
async function cmdDownload(folder, siteId, deployId) {
  const cfg = configFromEnv();
  let id = deployId;
  if (!id) {
    const sites = await api.listSites(cfg);
    id = sites.find((s) => s.siteId === siteId)?.liveDeployId;
    if (!id)
      throw new Error("Site has no live deploy; pass --deploy <id>");
  }
  const manifest = await api.getManifest(cfg, siteId, id);
  const local = await buildManifest(folder).catch(() => ({}));
  const d = diffManifests(local, manifest);
  const need = [...d.added, ...d.changed];
  console.log(`${need.length} files to fetch, ${d.unchanged.length} already current`);
  if (d.removed.length) {
    console.log(`Local-only files (NOT deleted \u2014 remove yourself if unwanted):`);
    for (const p of d.removed)
      console.log(`  ? ${p}`);
  }
  const hashes = [...new Set(need.map((p) => manifest[p].sha256))];
  for (let i = 0; i < hashes.length; i += 500) {
    const { urls } = await api.blobUrls(cfg, hashes.slice(i, i + 500));
    for (const path of need) {
      const entry = manifest[path];
      const url = urls[entry.sha256];
      if (!url)
        continue;
      const abs = join4(folder, path);
      await mkdir(dirname2(abs), { recursive: true });
      const res = await fetch(url);
      if (!res.ok || !res.body)
        throw new Error(`Download failed for ${path}: ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(abs));
      console.log(`  \u2193 ${path}`);
    }
  }
  await saveLastPublished(folder, siteId, manifest);
  console.log("Done.");
}
async function cmdPreview(folder, port = 4321) {
  const plan = await resolvePublish(folder);
  if (plan.build) {
    console.log(`\u2192 ${plan.build}`);
    execSync(plan.build, { cwd: folder, stdio: "inherit" });
  }
  console.log(plan.reason);
  const root = plan.dir;
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
      if (path.endsWith("/"))
        path += "index.html";
      else if (!extname2(path))
        path += "/index.html";
      const abs = resolve(join4(root, path));
      if (!abs.startsWith(resolve(root)))
        throw new Error("traversal");
      res.setHeader("content-type", contentTypeFor(abs));
      await pipeline(createReadStream2(abs), res);
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  });
  server.listen(port, () => console.log(`Previewing at http://localhost:${port}`));
}
async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case "sites": {
      const sites = await api.listSites(configFromEnv());
      for (const s of sites) {
        console.log(`${s.name}  ${s.siteId}  live=${s.liveDeployId ?? "\u2014"}`);
      }
      if (!sites.length)
        console.log("No sites yet. Create one: assemblage create <name>");
      break;
    }
    case "create": {
      const site = await api.createSite(configFromEnv(), positional[0]);
      console.log(`Created "${site.name}" \u2192 ${site.url}`);
      console.log(`siteId ${site.siteId}  (rename anytime: assemblage rename <siteId> <new-name>)`);
      break;
    }
    case "rename": {
      const [siteId, name] = positional;
      if (!siteId || !name)
        throw new Error("Usage: assemblage rename <siteId> <new-name>");
      const site = await api.renameSite(configFromEnv(), siteId, name);
      console.log(`Now "${site.name}" \u2192 ${site.url}`);
      break;
    }
    case "status":
      if (!positional[0] || !flags.site)
        throw new Error("Usage: assemblage status <folder> --site <siteId>");
      await cmdStatus(resolve(positional[0]), flags.site);
      break;
    case "preview":
      if (!positional[0])
        throw new Error("Usage: assemblage preview <folder> [--port N]");
      await cmdPreview(resolve(positional[0]), flags.port ? Number(flags.port) : void 0);
      break;
    case "publish":
      if (!positional[0] || !flags.site)
        throw new Error("Usage: assemblage publish <folder> --site <siteId>");
      await cmdPublish(resolve(positional[0]), flags.site);
      break;
    case "download":
      if (!positional[0] || !flags.site)
        throw new Error("Usage: assemblage download <folder> --site <siteId> [--deploy <id>]");
      await cmdDownload(resolve(positional[0]), flags.site, flags.deploy);
      break;
    case "claim": {
      const email = positional[0];
      if (!email)
        throw new Error("Usage: assemblage claim <email>");
      const res = await api.requestEmailVerification(configFromEnv(), email);
      console.log(`Verification link sent to ${res.email}. Click it to claim ownership of your sites (expires in 30 min).`);
      break;
    }
    case "whoami": {
      const acct = await api.getAccount(configFromEnv());
      console.log(`account ${acct.accountId}`);
      console.log(acct.emailVerifiedAt ? `owner    ${acct.email} (verified ${acct.emailVerifiedAt})` : "owner    unclaimed \u2014 run: assemblage claim <email>");
      break;
    }
    default:
      console.log("Commands: sites | create [name] | rename <siteId> <name> | status <folder> --site <id> | preview <folder> | publish <folder> --site <id> | download <folder> --site <id> [--deploy <id>] | claim <email> | whoami");
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
