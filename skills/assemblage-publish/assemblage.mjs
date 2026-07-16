#!/usr/bin/env node

// dist/cli.js
import { execSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream as createReadStream2, createWriteStream, existsSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile as readFile2, rename, rm, stat as stat3, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { dirname as dirname2, extname as extname2, join as join4, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

// ../../packages/protocol/dist/hash.js
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
async function hashFile(absPath) {
  const hash = createHash("sha256");
  await new Promise((resolve2, reject) => {
    createReadStream(absPath).on("data", (chunk) => hash.update(chunk)).on("end", resolve2).on("error", reject);
  });
  return hash.digest("hex");
}

// ../../packages/protocol/dist/manifest.js
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
var PRIVATE_KEY_EXTENSIONS = /* @__PURE__ */ new Set([".key", ".pem", ".p12", ".pfx"]);
var PROJECT_METADATA = /* @__PURE__ */ new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "dockerfile",
  "makefile"
]);
function isPublicDeployPath(path) {
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/");
  const name = parts.at(-1)?.toLowerCase() ?? "";
  const extension = extname(name);
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0"))
    return false;
  if (parts.some((part) => !part || part === "." || part === ".."))
    return false;
  if (parts.some((part, index) => part.startsWith(".") && !(index === 0 && part === ".well-known")))
    return false;
  if (PROJECT_METADATA.has(name))
    return false;
  if (/^readme(?:\..+)?$/i.test(name))
    return false;
  if (/^(?:ts|js)config(?:\..+)?\.json$/i.test(name))
    return false;
  if (PRIVATE_KEY_EXTENSIONS.has(extension))
    return false;
  return true;
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".svn", ".hg"]);
var SKIP_FILES = /* @__PURE__ */ new Set([".DS_Store", "Thumbs.db", "site.json"]);
async function buildManifest(root, opts = {}) {
  const manifest = {};
  await walk(root, root, manifest, opts);
  return manifest;
}
function buildDeployManifest(root, opts = {}) {
  return buildManifest(root, {
    filter: (path) => isPublicDeployPath(path) && (opts.filter?.(path) ?? true)
  });
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

// ../../packages/protocol/dist/resolve.js
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
var CONFIG_EXTS = [".mjs", ".js", ".ts", ".mts", ".cjs"];
async function readConfigText(root, base) {
  for (const ext of CONFIG_EXTS) {
    const name = base + ext;
    const text = await readFile(join2(root, name), "utf8").catch(() => void 0);
    if (text !== void 0)
      return { name, text };
  }
  return void 0;
}
var SERVER_FRAMEWORKS = [
  { dep: "express", name: "Express" },
  { dep: "fastify", name: "Fastify" },
  { dep: "koa", name: "Koa" },
  { dep: "@hapi/hapi", name: "hapi" },
  { dep: "@nestjs/core", name: "NestJS" },
  { dep: "@remix-run/server-runtime", name: "Remix" },
  { dep: "@remix-run/node", name: "Remix" }
];
var ASTRO_SSR_ADAPTERS = [
  "@astrojs/node",
  "@astrojs/vercel",
  "@astrojs/netlify",
  "@astrojs/cloudflare",
  "@astrojs/deno"
];
var SVELTEKIT_SERVER_ADAPTERS = [
  "@sveltejs/adapter-node",
  "@sveltejs/adapter-vercel",
  "@sveltejs/adapter-netlify",
  "@sveltejs/adapter-cloudflare",
  "@sveltejs/adapter-auto"
];
async function detectServerRuntime(root) {
  const abs = resolvePath(root);
  const pkg = await readJson(join2(abs, "package.json"));
  if (!pkg)
    return void 0;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const buildScript = pkg.scripts?.build ?? "";
  for (const f of SERVER_FRAMEWORKS) {
    if (f.dep in deps) {
      return {
        framework: f.name,
        detail: `${f.name} runs a server to answer requests, so none of that will respond once it's live. Only static files placed alongside it would be served.`,
        evidence: `"${f.dep}" is a dependency`
      };
    }
  }
  if ("next" in deps) {
    const cfg = await readConfigText(abs, "next.config");
    const staticExport = cfg && /output\s*:\s*['"]export['"]/.test(cfg.text) || /next\s+export/.test(buildScript);
    if (!staticExport) {
      return {
        framework: "Next.js",
        detail: "This Next.js app renders on a server, so server-side rendering, API routes, and server actions won't run. Only pages it can pre-render as plain HTML would be served.",
        evidence: cfg ? `${cfg.name} has no \`output: 'export'\`` : "no next.config with `output: 'export'`"
      };
    }
  }
  if ("astro" in deps) {
    const cfg = await readConfigText(abs, "astro.config");
    const serverOutput = cfg ? /output\s*:\s*['"](server|hybrid)['"]/.test(cfg.text) : false;
    const adapter = ASTRO_SSR_ADAPTERS.find((a) => a in deps);
    if (serverOutput || adapter) {
      return {
        framework: "Astro (SSR)",
        detail: "This Astro site has server rendering turned on, so on-demand pages and endpoints won't run. Only its pre-rendered pages would be served.",
        evidence: serverOutput ? `${cfg?.name} sets a server output mode` : `SSR adapter "${adapter}" is a dependency`
      };
    }
  }
  if ("@sveltejs/kit" in deps) {
    const serverAdapter = SVELTEKIT_SERVER_ADAPTERS.find((a) => a in deps);
    if (serverAdapter && !("@sveltejs/adapter-static" in deps)) {
      return {
        framework: "SvelteKit",
        detail: "This SvelteKit app renders on a server, so server routes and load functions won't run. Only pre-rendered pages would be served.",
        evidence: `server adapter "${serverAdapter}" (not adapter-static)`
      };
    }
  }
  if ("nuxt" in deps && !/nux[ti]\s+generate/.test(buildScript)) {
    return {
      framework: "Nuxt",
      detail: "This Nuxt app renders on a server, so server routes and API handlers won't run. Building with `nuxt generate` would produce a static site instead.",
      evidence: "build script is not `nuxt generate`"
    };
  }
  return void 0;
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

// ../../packages/protocol/dist/project.js
var MAX_PROJECT_BUNDLE_BYTES = 100 * 1024 * 1024;
var MAX_MEDIA_ASSETS = 1e4;
var MAX_MEDIA_BLOB_BYTES = 5 * 1024 * 1024 * 1024;
var MAX_SERVER_BUILD_OUTPUT_BYTES = 8 * 1024 * 1024 * 1024;
var SHA256 = /^[a-f0-9]{64}$/;
function isSha256(value) {
  return SHA256.test(value);
}

// dist/api.js
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
  inviteCollaborator: (cfg, siteId, email) => call(cfg, "POST", `/sites/${siteId}/collaborators`, { email }),
  acceptCollaborationInvitation: (cfg, token) => call(cfg, "POST", "/collaboration/invitations/accept", {
    token
  }),
  listCollaborators: (cfg, siteId) => call(cfg, "GET", `/sites/${siteId}/collaborators`),
  removeCollaborator: (cfg, siteId, accountId) => call(cfg, "DELETE", `/sites/${siteId}/collaborators/${accountId}`),
  createDeploy: (cfg, siteId, manifest) => call(cfg, "POST", `/sites/${siteId}/deploys`, { manifest }),
  finalize: (cfg, siteId, deployId) => call(cfg, "POST", `/sites/${siteId}/deploys/${deployId}/finalize`),
  publish: (cfg, siteId, deployId) => call(cfg, "POST", `/sites/${siteId}/publish`, { deployId }),
  getManifest: (cfg, siteId, deployId) => call(cfg, "GET", `/sites/${siteId}/deploys/${deployId}/manifest`),
  blobUrls: (cfg, hashes) => call(cfg, "POST", "/blobs/urls", { hashes }),
  getProject: (cfg, siteId) => call(cfg, "GET", `/sites/${siteId}/project`),
  prepareProjectUpdate: (cfg, siteId, body) => call(cfg, "POST", `/sites/${siteId}/project/updates`, body),
  finalizeProjectUpdate: (cfg, siteId, updateId) => call(cfg, "POST", `/sites/${siteId}/project/updates/${updateId}/finalize`),
  createProjectBuild: (cfg, siteId, headCommit) => call(cfg, "POST", `/sites/${siteId}/project/builds`, { headCommit }),
  getProjectBuild: (cfg, siteId, buildId) => call(cfg, "GET", `/sites/${siteId}/project/builds/${buildId}`),
  cancelProjectBuild: (cfg, siteId, buildId) => call(cfg, "DELETE", `/sites/${siteId}/project/builds/${buildId}`),
  prepareMediaUploads: (cfg, siteId, assets) => call(cfg, "POST", `/sites/${siteId}/media/uploads`, { assets }),
  mediaDownloadUrls: (cfg, siteId, hashes) => call(cfg, "POST", `/sites/${siteId}/media/downloads`, { hashes }),
  requestEmailVerification: (cfg, email) => call(cfg, "POST", "/account/email", { email }),
  getAccount: (cfg) => call(cfg, "GET", "/account"),
  attachDomain: (cfg, siteId, domain) => call(cfg, "POST", `/sites/${siteId}/domain`, { domain }),
  domainStatus: (cfg, siteId) => call(cfg, "GET", `/sites/${siteId}/domain`),
  removeDomain: (cfg, siteId) => call(cfg, "DELETE", `/sites/${siteId}/domain`),
  /** Operator-only surface — requires an admin token/verified admin email. */
  admin: {
    users: (cfg) => call(cfg, "GET", "/admin/users"),
    resolve: (cfg, body) => call(cfg, "POST", "/admin/resolve", body),
    ban: (cfg, body) => call(cfg, "POST", "/admin/ban", body),
    unban: (cfg, body) => call(cfg, "POST", "/admin/unban", body),
    comp: (cfg, body) => call(cfg, "POST", "/admin/comp", body),
    uncomp: (cfg, body) => call(cfg, "POST", "/admin/uncomp", body),
    renameSite: (cfg, body) => call(cfg, "POST", "/admin/site/rename", body),
    moveSite: (cfg, body) => call(cfg, "POST", "/admin/site/move", body),
    reindex: (cfg) => call(cfg, "POST", "/admin/reindex")
  }
};

// dist/cli.js
var BOOLEAN_FLAGS = /* @__PURE__ */ new Set(["force", "allow-server", "json"]);
function parseArgs(argv) {
  const [cmd = "help", ...rest] = argv;
  const positional = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else {
        flags[key] = rest[++i];
      }
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
  await ensureGitignored(folder, ".assemblage/");
}
async function ensureGitignored(folder, entry) {
  const gitignore = join4(folder, ".gitignore");
  let contents;
  try {
    contents = await readFile2(gitignore, "utf8");
  } catch {
    return;
  }
  const listed = contents.split("\n").some((line) => line.trim().replace(/\/$/, "") === entry.replace(/\/$/, ""));
  if (listed)
    return;
  const sep = contents.length > 0 && !contents.endsWith("\n") ? "\n" : "";
  await writeFile(gitignore, `${contents}${sep}${entry}
`);
}
async function readBinding(folder) {
  try {
    return JSON.parse(await readFile2(join4(folder, ".assemblage", "binding.json"), "utf8"));
  } catch {
    return void 0;
  }
}
async function writeBinding(folder, binding) {
  const dir = join4(folder, ".assemblage");
  await mkdir(dir, { recursive: true });
  await writeFile(join4(dir, "binding.json"), JSON.stringify(binding, null, 2));
}
async function folderKnowsSite(folder, siteId) {
  return await lastPublished(folder, siteId) !== void 0;
}
async function resolveSite(cfg, identifier) {
  const sites = await api.listSites(cfg);
  const match = sites.find((s) => s.subdomain === identifier || s.name === identifier || s.siteId === identifier);
  if (!match) {
    throw new Error(`No site "${identifier}" in this account.
List your sites with "assemblage sites", or create one with "assemblage create <name>".`);
  }
  return match;
}
async function resolveSiteIdLocally(folder, identifier) {
  const binding = await readBinding(folder);
  if (binding && (identifier === binding.name || identifier === binding.siteId))
    return binding.siteId;
  return identifier;
}
async function siteIdentifierForFolder(folder, explicit, usage) {
  if (typeof explicit === "string" && explicit.length > 0)
    return explicit;
  const binding = await readBinding(folder);
  if (binding?.siteId)
    return binding.siteId;
  throw new Error(`${usage}
No site is bound to this folder yet. Create one first, or pass --site <site>.`);
}
async function siteIdentifierFromCurrentDirectory(explicit, usage) {
  return siteIdentifierForFolder(process.cwd(), explicit, usage);
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
var PUBLISH_READINESS_TIMEOUT_MS = 45e3;
async function waitForPublishedSite(url) {
  const status = async () => {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(5e3)
      });
      await response.body?.cancel();
      return response.status;
    } catch {
      return void 0;
    }
  };
  if (await status() !== 403)
    return;
  console.log("Waiting for the site to become reachable\u2026");
  const deadline = Date.now() + PUBLISH_READINESS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1e3));
    if (await status() !== 403)
      return;
  }
  console.log("CloudFront is still finishing the update; the site should appear shortly.");
}
var DOMAIN_STATUS_LABEL = {
  pending_dns: "waiting on DNS",
  live: "live",
  failed: "needs attention"
};
function printDomain(d, siteRef) {
  console.log(`${d.domain} \u2014 ${DOMAIN_STATUS_LABEL[d.status]}`);
  console.log(d.detail);
  if (d.records.length && d.status !== "live") {
    console.log("\nStep 1 \u2014 add these DNS records where you manage the domain:");
    for (const r of d.records) {
      console.log(`  ${r.type}  ${r.host}  \u2192  ${r.value}`);
      if (r.note)
        console.log(`      (${r.note})`);
    }
    console.log(`
Step 2 \u2014 once they're in, check on it:  assemblage domain status --site ${siteRef}`);
    console.log(`HTTPS turns on automatically as soon as ${d.domain} points here.`);
  }
}
async function checkServerRuntime(folder, gate, allowed) {
  const server = await detectServerRuntime(folder);
  if (!server)
    return;
  if (gate && !allowed) {
    throw new Error(`${server.framework}: this looks like a site that needs a server to run.
${server.detail}
(Detected: ${server.evidence}.)
Assemblage hosts static files only. To publish the statically-rendered output anyway, re-run with --allow-server.`);
  }
  console.log(`Note: ${server.detail} (Assemblage serves static files only.)`);
}
async function preparedManifest(folder) {
  const plan = await resolvePublish(folder);
  if (plan.build) {
    console.log(`\u2192 ${plan.build}`);
    execSync(plan.build, { cwd: folder, stdio: "inherit" });
  }
  const manifest = await buildDeployManifest(plan.dir);
  return { manifest, dir: plan.dir, note: plan.reason };
}
async function cmdStatus(folder, identifier) {
  const siteId = await resolveSiteIdLocally(folder, identifier);
  await checkServerRuntime(folder, false, false);
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
async function cmdPublish(folder, identifier, force = false, allowServer = false) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  if (target.access === "collaborator") {
    throw new Error(`\u201C${target.name}\u201D is shared with you. Use assemblage share <folder> --site ${target.name} to send source changes; only the owner publishes the live site.`);
  }
  const siteId = target.siteId;
  const knownHere = await folderKnowsSite(folder, siteId);
  if (!knownHere && target.liveDeployId && !force) {
    const binding = await readBinding(folder);
    const boundNote = binding && binding.siteId !== siteId ? `
This folder is already published as "${binding.name ?? binding.siteId}" \u2014 publishing it here would be a different site.` : "";
    throw new Error(`Refusing to overwrite "${target.name}".
This folder has never been published to "${target.name}", and that site already has a live version. Publishing now would REPLACE it with this folder's contents.${boundNote}
\u2022 To put this folder online as its own site, create one: assemblage create <name>
\u2022 To replace "${target.name}" on purpose, re-run with --force.`);
  }
  await checkServerRuntime(folder, true, allowServer);
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
  await waitForPublishedSite(pub.liveUrl);
  await saveLastPublished(folder, siteId, manifest);
  await writeBinding(folder, { siteId, name: target.name });
  console.log(`Live: ${pub.liveUrl}`);
  console.log(`Preview: ${fin.previewUrl}`);
}
async function cmdPublishShared(identifier) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  if (target.access === "collaborator") {
    throw new Error("Only the site owner can publish these changes live. You can still share source changes.");
  }
  const project = await api.getProject(cfg, target.siteId);
  if (!project.headCommit)
    throw new Error("There are no shared changes to publish yet. Run share first.");
  let build = await api.createProjectBuild(cfg, target.siteId, project.headCommit);
  console.log("Building your site\u2026");
  let cancelRequested = false;
  let lastDetail = "";
  const requestCancellation = () => {
    cancelRequested = true;
    console.log("\nStopping the build safely\u2026");
  };
  process.once("SIGINT", requestCancellation);
  try {
    while (build.status === "building") {
      if (build.detail && build.detail !== lastDetail) {
        console.log(`\u2192 ${build.detail}`);
        lastDetail = build.detail;
      }
      if (cancelRequested) {
        build = await api.cancelProjectBuild(cfg, target.siteId, build.buildId);
        if (build.status === "cancelled")
          break;
        console.log("The site is already being made live, so it will finish publishing.");
        cancelRequested = false;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2e3));
      build = await api.getProjectBuild(cfg, target.siteId, build.buildId);
    }
  } finally {
    process.removeListener("SIGINT", requestCancellation);
  }
  if (build.status === "cancelled") {
    console.log("Build cancelled. The current live site was not changed.");
    return;
  }
  if (build.status === "failed")
    throw new Error(build.error ?? "The server build failed.");
  await waitForPublishedSite(build.liveUrl);
  console.log(`Live: ${build.liveUrl}`);
}
async function cmdDownload(folder, identifier, deployId) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const siteId = target.siteId;
  let id = deployId;
  if (!id) {
    id = target.liveDeployId;
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
  await writeBinding(folder, { siteId, name: target.name });
  console.log("Done.");
}
function runNative(request, failure) {
  const here = dirname2(fileURLToPath(import.meta.url));
  const candidates = [
    process.env["ASSEMBLAGE_CORE_BIN"],
    join4(here, "assemblage-core"),
    join4(here, "../../../target/release/assemblage-core"),
    join4(here, "../../../target/debug/assemblage-core")
  ].filter((candidate) => Boolean(candidate));
  const binary = candidates.find(existsSync) ?? "assemblage-core";
  const result = spawnSync(binary, [], {
    input: JSON.stringify(request),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) {
    throw new Error(`Assemblage's collaboration engine is unavailable (${result.error.message}). Build it with "pnpm build:native" or set ASSEMBLAGE_CORE_BIN.`);
  }
  if (result.status !== 0)
    throw new Error(`${failure}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}
function prepareCollaborativeSnapshot(folder, author) {
  return runNative({ command: "prepare", path: folder, author }, "Could not prepare the site for collaboration");
}
function markCollaborativeSnapshotShared(folder, commit) {
  runNative({ command: "mark_shared", path: folder, commit }, "Shared successfully, but could not update local collaboration state");
}
function validateMediaManifest(value) {
  const manifest = value;
  if (!manifest || manifest.version !== 1 || !manifest.assets || Array.isArray(manifest.assets)) {
    throw new Error("The managed media list is invalid. Run share again to rebuild it.");
  }
  const entries = Object.entries(manifest.assets);
  if (entries.length > MAX_MEDIA_ASSETS)
    throw new Error(`Managed media is limited to ${MAX_MEDIA_ASSETS} files.`);
  for (const [path, entry] of entries) {
    if (!isPublicDeployPath(path) || !entry || !isSha256(entry.sha256) || !Number.isInteger(entry.size) || entry.size < 0 || entry.size > MAX_MEDIA_BLOB_BYTES || typeof entry.contentType !== "string" || !entry.contentType) {
      throw new Error(`The managed media entry for \u201C${path}\u201D is invalid.`);
    }
  }
  return manifest;
}
async function readMediaManifest(folder) {
  try {
    return validateMediaManifest(JSON.parse(await readFile2(join4(folder, ".assemblage-media.json"), "utf8")));
  } catch (error) {
    if (error.code === "ENOENT")
      return { version: 1, assets: {} };
    throw error;
  }
}
async function uploadManagedMedia(cfg, siteId, folder, media) {
  const manifest = validateMediaManifest(media);
  const byHash = /* @__PURE__ */ new Map();
  for (const [path, entry] of Object.entries(manifest.assets)) {
    if (!byHash.has(entry.sha256))
      byHash.set(entry.sha256, { path, entry });
  }
  if (!byHash.size)
    return { uploaded: 0, bytes: 0 };
  const prepared = await api.prepareMediaUploads(cfg, siteId, manifest.assets);
  const bytes = prepared.missing.reduce((total, hash) => total + (byHash.get(hash)?.entry.size ?? 0), 0);
  if (!prepared.missing.length)
    return { uploaded: 0, bytes: 0 };
  console.log(`Uploading ${prepared.missing.length} new media file${prepared.missing.length === 1 ? "" : "s"} (${fmtBytes(bytes)})\u2026`);
  const concurrency = 4;
  for (let index = 0; index < prepared.missing.length; index += concurrency) {
    await Promise.all(prepared.missing.slice(index, index + concurrency).map(async (hash) => {
      const found = byHash.get(hash);
      if (!found)
        throw new Error(`Managed media list is missing ${hash}`);
      const absolute = join4(folder, ...found.path.split("/"));
      const file = await stat3(absolute);
      if (!file.isFile() || file.size !== found.entry.size || await hashFile(absolute) !== hash) {
        throw new Error(`\u201C${found.path}\u201D changed while it was being shared. Run share again.`);
      }
      const response = await fetch(prepared.uploadUrls[hash], {
        method: "PUT",
        headers: {
          "content-type": found.entry.contentType,
          "content-length": String(found.entry.size),
          "x-amz-checksum-sha256": Buffer.from(hash, "hex").toString("base64")
        },
        body: Readable.toWeb(createReadStream2(absolute)),
        duplex: "half"
      });
      if (!response.ok) {
        throw new Error(`Could not upload \u201C${found.path}\u201D: ${response.status} ${await response.text()}`);
      }
    }));
  }
  return { uploaded: prepared.missing.length, bytes };
}
async function ensureSafeMediaParent(folder, mediaPath) {
  const parts = mediaPath.split("/");
  let cursor = folder;
  for (const part of parts.slice(0, -1)) {
    cursor = join4(cursor, part);
    try {
      const entry = await lstat(cursor);
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        throw new Error(`Cannot restore media through \u201C${mediaPath}\u201D because its parent is not a safe folder.`);
      }
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
      await mkdir(cursor);
    }
  }
  return join4(cursor, parts.at(-1));
}
async function mediaPathState(folder, path, expected) {
  const absolute = join4(folder, ...path.split("/"));
  try {
    const entry = await lstat(absolute);
    if (entry.isSymbolicLink() || !entry.isFile() || entry.size !== expected.size)
      return "different";
    return await hashFile(absolute) === expected.sha256 ? "present" : "different";
  } catch (error) {
    if (error.code === "ENOENT")
      return "missing";
    throw error;
  }
}
async function syncManagedMedia(cfg, siteId, folder) {
  const manifest = await readMediaManifest(folder);
  const missing = [];
  const conflicts = [];
  for (const [path, entry] of Object.entries(manifest.assets)) {
    const state = await mediaPathState(folder, path, entry);
    if (state === "missing")
      missing.push({ path, entry });
    if (state === "different")
      conflicts.push(path);
  }
  if (!missing.length)
    return { downloaded: 0, bytes: 0, conflicts };
  const urls = {};
  const hashes = [...new Set(missing.map(({ entry }) => entry.sha256))];
  for (let index = 0; index < hashes.length; index += 500) {
    Object.assign(urls, (await api.mediaDownloadUrls(cfg, siteId, hashes.slice(index, index + 500))).urls);
  }
  const bytes = missing.reduce((total, { entry }) => total + entry.size, 0);
  console.log(`Downloading ${missing.length} media file${missing.length === 1 ? "" : "s"} (${fmtBytes(bytes)})\u2026`);
  const concurrency = 4;
  let downloaded = 0;
  for (let index = 0; index < missing.length; index += concurrency) {
    await Promise.all(missing.slice(index, index + concurrency).map(async ({ path, entry }) => {
      const destination = await ensureSafeMediaParent(folder, path);
      const temporary = `${destination}.assemblage-${randomUUID()}.download`;
      const response = await fetch(urls[entry.sha256]);
      if (!response.ok || !response.body) {
        throw new Error(`Could not download \u201C${path}\u201D: ${response.status} ${await response.text()}`);
      }
      try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "wx" }));
        const received = await stat3(temporary);
        if (received.size !== entry.size || await hashFile(temporary) !== entry.sha256) {
          throw new Error(`Downloaded media failed its integrity check: \u201C${path}\u201D`);
        }
        if (await mediaPathState(folder, path, entry) !== "missing") {
          conflicts.push(path);
          return;
        }
        await rename(temporary, destination);
        downloaded += 1;
      } finally {
        await rm(temporary, { force: true });
      }
    }));
  }
  return { downloaded, bytes, conflicts: [...new Set(conflicts)] };
}
function printMediaSync(result) {
  if (result.downloaded)
    console.log(`Restored ${result.downloaded} media file${result.downloaded === 1 ? "" : "s"}.`);
  if (result.conflicts.length) {
    console.log(`Kept ${result.conflicts.length} different local media file${result.conflicts.length === 1 ? "" : "s"} unchanged:`);
    for (const path of result.conflicts)
      console.log(`  ! ${path}`);
  }
}
function describeConflict(path, kind) {
  if (path === ".assemblage-media.json")
    return "your media libraries changed in incompatible ways";
  switch (kind) {
    case "both_modified":
      return "you both edited this file";
    case "both_added":
      return "you both created a different version of this file";
    case "removed_locally_changed_incoming":
      return "you removed this file while your collaborator edited it";
    case "changed_locally_removed_incoming":
      return "you edited this file while your collaborator removed it";
    case "path_changed":
      return "the file or folder changed in incompatible ways";
  }
}
function previewVersion(label, version) {
  if (!version) {
    console.log(`    ${label}: removed`);
    return;
  }
  if (!version.preview) {
    console.log(`    ${label}: ${version.size.toLocaleString()} byte file`);
    return;
  }
  const preview = version.preview.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  console.log(`    ${label}: ${JSON.stringify(preview)}`);
}
async function guideConflictResolution(folder, result) {
  const conflicts = result.conflicts ?? [];
  if (!result.local_commit || conflicts.length === 0) {
    throw new Error("These changes could not be combined automatically. Nothing was overwritten.");
  }
  if (!input.isTTY || !output.isTTY) {
    const details = conflicts.map((conflict) => `  \u2022 ${conflict.path} \u2014 ${describeConflict(conflict.path, conflict.kind)}`).join("\n");
    throw new Error(`These changes need your choices. Run sync in an interactive terminal; nothing was overwritten.
${details}`);
  }
  const prompt = createInterface({ input, output });
  const resolutions = [];
  try {
    console.log(`
You and a collaborator changed ${conflicts.length === 1 ? "the same file" : `${conflicts.length} of the same files`}.`);
    console.log("Choose the version to keep for each one. Nothing changes until all choices are complete.\n");
    for (const conflict of conflicts) {
      console.log(`${conflict.path} \u2014 ${describeConflict(conflict.path, conflict.kind)}`);
      if (conflict.path !== ".assemblage-media.json") {
        previewVersion("Yours", conflict.local);
        previewVersion("Theirs", conflict.incoming);
      }
      const localLabel = conflict.local ? "keep yours" : "keep it removed";
      const incomingLabel = conflict.incoming ? "use theirs" : "remove it";
      let answer = "";
      while (!["1", "2", "q"].includes(answer)) {
        answer = (await prompt.question(`  [1] ${localLabel}  [2] ${incomingLabel}  [q] stop: `)).trim().toLowerCase();
      }
      if (answer === "q")
        throw new Error("Stopped. Nothing was changed.");
      resolutions.push({ path: conflict.path, choice: answer === "1" ? "local" : "incoming" });
      console.log();
    }
  } finally {
    prompt.close();
  }
  return runNative({
    command: "resolve_merge",
    path: folder,
    expected_local_commit: result.local_commit,
    incoming_commit: result.remote_commit,
    resolutions
  }, "Could not combine the chosen versions");
}
async function cmdSync(folder, identifier, machineReadable = false) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const remote = await api.getProject(cfg, target.siteId);
  if (!remote.headCommit || !remote.bundle) {
    console.log(machineReadable ? JSON.stringify({ status: "no_shared_changes" }) : "No shared changes yet.");
    return;
  }
  const temporary = await mkdtemp(join4(tmpdir(), "assemblage-project-"));
  const bundlePath = join4(temporary, "project.bundle");
  try {
    const response = await fetch(remote.bundle.downloadUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Could not get shared changes: ${response.status} ${await response.text()}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(bundlePath));
    const result = runNative({
      command: "receive",
      path: folder,
      bundle_path: bundlePath,
      expected_sha256: remote.bundle.sha256
    }, "Could not apply shared changes");
    let mediaReady = result.status !== "needs_merge";
    if (!machineReadable) {
      switch (result.status) {
        case "installed":
          console.log("Got the latest shared changes.");
          break;
        case "fast_forwarded":
          console.log("Updated to the latest shared changes.");
          break;
        case "up_to_date":
          console.log("You already have everyone\u2019s latest changes.");
          break;
        case "local_ahead":
          console.log("Your local changes are newer. Share them when you are ready.");
          break;
        case "merged":
          console.log("Combined your changes with the latest shared changes. Review the site, then share when you approve it.");
          break;
        case "needs_merge": {
          await guideConflictResolution(folder, result);
          mediaReady = true;
          console.log("Combined your choices locally. Review the site, then run share when you approve it.");
          break;
        }
      }
    }
    const media = mediaReady ? await syncManagedMedia(cfg, target.siteId, folder) : void 0;
    if (machineReadable) {
      console.log(JSON.stringify({ ...result, generation: remote.generation, media }));
      return;
    }
    if (media)
      printMediaSync(media);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
async function cmdResolve(folder, sessionPath, choicesPath, machineReadable = false) {
  const sessionDocument = JSON.parse(await readFile2(resolve(sessionPath), "utf8"));
  const choicesDocument = JSON.parse(await readFile2(resolve(choicesPath), "utf8"));
  const resolutions = Array.isArray(choicesDocument) ? choicesDocument : choicesDocument.resolutions;
  const localCommit = sessionDocument.session?.local_commit;
  const incomingCommit = sessionDocument.session?.incoming_commit;
  if (!localCommit || !incomingCommit || !resolutions) {
    throw new Error("The merge session or proposed choices file is incomplete.");
  }
  const result = runNative({
    command: "resolve_merge",
    path: folder,
    expected_local_commit: localCommit,
    incoming_commit: incomingCommit,
    resolutions
  }, "Could not apply the proposed combined version");
  console.log(machineReadable ? JSON.stringify(result) : "Applied the combined version locally. Review the site, then run share when you approve it.");
}
async function cmdShare(folder, identifier, authorName, authorEmail) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const account = await api.getAccount(cfg);
  const email = authorEmail ?? account.email;
  if (!email) {
    throw new Error("Sharing needs your email for version history. Pass --email <you@example.com>.");
  }
  const name = authorName ?? email.split("@")[0] ?? "Collaborator";
  const snapshot = prepareCollaborativeSnapshot(folder, { name, email });
  const remote = await api.getProject(cfg, target.siteId);
  const sourceAlreadyShared = remote.headCommit === snapshot.commit;
  if (!sourceAlreadyShared && remote.headCommit !== (snapshot.base_commit ?? snapshot.parent_commit)) {
    throw new Error("Someone else shared changes first. Run sync to safely combine them with yours; no files were uploaded.");
  }
  const media = await uploadManagedMedia(cfg, target.siteId, folder, snapshot.media);
  if (media.uploaded)
    console.log(`Uploaded ${media.uploaded} new media file${media.uploaded === 1 ? "" : "s"}.`);
  if (sourceAlreadyShared) {
    markCollaborativeSnapshotShared(folder, snapshot.commit);
    console.log("Everyone already has these source changes.");
    return;
  }
  const prepared = await api.prepareProjectUpdate(cfg, target.siteId, {
    baseCommit: remote.headCommit,
    headCommit: snapshot.commit,
    bundleSha256: snapshot.bundle.sha256,
    bundleSize: snapshot.bundle.size
  });
  const size = (await stat3(snapshot.bundle.path)).size;
  const uploaded = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/x-git-bundle",
      "content-length": String(size),
      "x-amz-checksum-sha256": Buffer.from(snapshot.bundle.sha256, "hex").toString("base64")
    },
    body: Readable.toWeb(createReadStream2(snapshot.bundle.path)),
    duplex: "half"
  });
  if (!uploaded.ok)
    throw new Error(`Could not upload shared changes: ${uploaded.status} ${await uploaded.text()}`);
  await api.finalizeProjectUpdate(cfg, target.siteId, prepared.updateId);
  markCollaborativeSnapshotShared(folder, snapshot.commit);
  console.log("Shared your changes.");
}
async function cmdMediaSync(folder, identifier, machineReadable = false) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const result = await syncManagedMedia(cfg, target.siteId, folder);
  if (machineReadable)
    console.log(JSON.stringify(result));
  else if (!result.downloaded && !result.conflicts.length)
    console.log("All managed media is already here.");
  else
    printMediaSync(result);
}
async function cmdInvite(email, identifier) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const invitation = await api.inviteCollaborator(cfg, target.siteId, email);
  if (invitation.sent) {
    console.log(`Invitation sent to ${invitation.email}. It expires ${new Date(invitation.expiresAt).toLocaleDateString()}.`);
  } else {
    console.log(`Send this invitation to ${invitation.email}:
${invitation.inviteUrl}`);
  }
}
async function cmdJoin(invitation) {
  const result = await api.acceptCollaborationInvitation(configFromEnv(), invitation);
  if (result.status === "verification_sent") {
    console.log(`Check ${result.email} to finish joining \u201C${result.siteName}\u201D.`);
    return;
  }
  console.log(`You can now collaborate on \u201C${result.siteName}\u201D.`);
  console.log(`Get the latest source with: assemblage sync <folder> --site ${result.siteId}`);
}
async function cmdCollaborators(identifier) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const collaborators = await api.listCollaborators(cfg, target.siteId);
  for (const collaborator of collaborators) {
    console.log(`${collaborator.email}  joined=${collaborator.joinedAt}`);
  }
  if (!collaborators.length)
    console.log("No collaborators yet.");
}
async function cmdRemoveCollaborator(email, identifier) {
  const cfg = configFromEnv();
  const target = await resolveSite(cfg, identifier);
  const collaborators = await api.listCollaborators(cfg, target.siteId);
  const collaborator = collaborators.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!collaborator)
    throw new Error(`${email} is not a collaborator on \u201C${target.name}\u201D.`);
  const result = await api.removeCollaborator(cfg, target.siteId, collaborator.accountId);
  console.log(`Removed ${result.removed} from \u201C${target.name}\u201D.`);
}
async function cmdPreview(folder, port = 4321) {
  await checkServerRuntime(folder, false, false);
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
async function cmdAdmin(positional, flags) {
  const cfg = configFromEnv();
  const sub = positional[0];
  const site = typeof flags.site === "string" ? flags.site : void 0;
  const email = typeof flags.email === "string" ? flags.email : void 0;
  const toEmail = typeof flags["to-email"] === "string" ? flags["to-email"] : void 0;
  switch (sub) {
    case "users": {
      const { accounts } = await api.admin.users(cfg);
      for (const a of accounts) {
        const bits = [
          a.accountId,
          a.email ? `<${a.email}>` : "unclaimed",
          `sites=${a.siteCount}`,
          a.bannedAt ? "BANNED" : "",
          a.comp ? "COMP" : ""
        ].filter(Boolean);
        console.log(bits.join("  "));
      }
      if (!accounts.length)
        console.log("No accounts.");
      break;
    }
    case "lookup": {
      const url = typeof flags.url === "string" ? flags.url : void 0;
      if (!email && !site && !url)
        throw new Error("Usage: assemblage admin lookup --email <e> | --site <name> | --url <url>");
      const { account, sites } = await api.admin.resolve(cfg, { email, site, url });
      if (account) {
        console.log(`account ${account.accountId}`);
        console.log(`owner   ${account.email ?? "unclaimed"}${account.emailVerifiedAt ? " (verified)" : ""}`);
        console.log(`signup  ${account.signedUpAt || "\u2014"}`);
        if (account.bannedAt)
          console.log(`BANNED  ${account.bannedAt}${account.banReason ? ` \u2014 ${account.banReason}` : ""}`);
        if (account.comp)
          console.log(`comp    ${account.comp.plan} (by ${account.comp.grantedBy}${account.comp.note ? `, ${account.comp.note}` : ""})`);
      } else {
        console.log("account \u2014");
      }
      for (const s of sites) {
        console.log(`  ${s.name}  ${s.siteId}  live=${s.liveDeployId ?? "\u2014"}${s.comp ? "  COMP" : ""}  ${s.url ?? ""}`);
      }
      if (!sites.length)
        console.log("  (no sites)");
      break;
    }
    case "ban": {
      if (!email)
        throw new Error('Usage: assemblage admin ban --email <e> [--reason "\u2026"]');
      const reason = typeof flags.reason === "string" ? flags.reason : void 0;
      const res = await api.admin.ban(cfg, { email, reason });
      console.log(`Banned ${res.banned}${res.accountSuspended ? " (account suspended)" : " (no account bound yet)"}`);
      break;
    }
    case "unban": {
      if (!email)
        throw new Error("Usage: assemblage admin unban --email <e>");
      const res = await api.admin.unban(cfg, { email });
      console.log(`Unbanned ${res.unbanned}`);
      break;
    }
    case "comp": {
      if (!email)
        throw new Error('Usage: assemblage admin comp --email <e> [--site <name>] [--note "\u2026"]');
      const note = typeof flags.note === "string" ? flags.note : void 0;
      const res = await api.admin.comp(cfg, { email, site, note });
      console.log(res.granted === "site" ? `Comped site "${res.site}" for ${res.email}` : `Comped ${res.email} (lifetime-free)`);
      break;
    }
    case "uncomp": {
      if (!email)
        throw new Error("Usage: assemblage admin uncomp --email <e> [--site <name>]");
      const res = await api.admin.uncomp(cfg, { email, site });
      console.log(res.cleared === "site" ? `Removed comp on "${res.site}" for ${res.email}` : `Removed comp for ${res.email}`);
      break;
    }
    case "rename": {
      const to = typeof flags.to === "string" ? flags.to : void 0;
      if (!site || !to)
        throw new Error("Usage: assemblage admin rename --site <name> --to <new-name>");
      const s = await api.admin.renameSite(cfg, { site, to });
      console.log(`Renamed \u2192 "${s.name}"  ${s.url}`);
      break;
    }
    case "move": {
      if (!site || !toEmail)
        throw new Error("Usage: assemblage admin move --site <name> --to-email <e>");
      const res = await api.admin.moveSite(cfg, { site, toEmail });
      console.log(`Moved "${res.site}" \u2192 ${toEmail} (${res.to})`);
      break;
    }
    case "reindex": {
      const res = await api.admin.reindex(cfg);
      console.log(`Reindexed ${res.reindexed} name\u2192owner rows.`);
      break;
    }
    default:
      console.log("admin commands: users | lookup --email|--site|--url | ban|unban --email <e> | comp|uncomp --email <e> [--site <name>] | rename --site <name> --to <new> | move --site <name> --to-email <e> | reindex");
  }
}
async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case "sites": {
      const sites = await api.listSites(configFromEnv());
      for (const s of sites) {
        console.log(`${s.name}  ${s.siteId}  live=${s.liveDeployId ?? "\u2014"}${s.access === "collaborator" ? "  shared" : ""}`);
      }
      if (!sites.length)
        console.log("No sites yet. Create one: assemblage create <name>");
      break;
    }
    case "create": {
      const site = await api.createSite(configFromEnv(), positional[0]);
      console.log(`Created "${site.name}" \u2192 ${site.url}`);
      console.log(`siteId ${site.siteId}  (commands take the subdomain "${site.subdomain}" too \u2014 e.g. assemblage publish <folder> --site ${site.subdomain})`);
      break;
    }
    case "rename": {
      const [identifier, name] = positional;
      if (!identifier || !name)
        throw new Error("Usage: assemblage rename <site> <new-name>");
      const cfg = configFromEnv();
      const target = await resolveSite(cfg, identifier);
      const site = await api.renameSite(cfg, target.siteId, name);
      console.log(`Now "${site.name}" \u2192 ${site.url}`);
      break;
    }
    case "status": {
      const folder = resolve(positional[0] ?? ".");
      const site = await siteIdentifierForFolder(folder, flags.site, "Usage: assemblage status [folder] [--site <site>]");
      await cmdStatus(folder, site);
      break;
    }
    case "preview":
      if (!positional[0])
        throw new Error("Usage: assemblage preview <folder> [--port N]");
      await cmdPreview(resolve(positional[0]), flags.port ? Number(flags.port) : void 0);
      break;
    case "publish":
      if (positional[0] || !flags.site) {
        const folder = resolve(positional[0] ?? ".");
        const site = await siteIdentifierForFolder(folder, flags.site, "Usage: assemblage publish [folder] [--site <site>] [--force] [--allow-server]");
        await cmdPublish(folder, site, flags.force ?? false, Boolean(flags["allow-server"]));
      } else {
        await cmdPublishShared(flags.site);
      }
      break;
    case "download": {
      const folder = resolve(positional[0] ?? ".");
      const site = await siteIdentifierForFolder(folder, flags.site, "Usage: assemblage download [folder] [--site <site>] [--deploy <id>]");
      await cmdDownload(folder, site, flags.deploy);
      break;
    }
    case "share": {
      const folder = resolve(positional[0] ?? ".");
      const site = await siteIdentifierForFolder(folder, flags.site, "Usage: assemblage share [folder] [--site <site>] [--name <name>] [--email <email>]");
      await cmdShare(folder, site, flags.name, flags.email);
      break;
    }
    case "sync": {
      const folder = resolve(positional[0] ?? ".");
      const site = await siteIdentifierForFolder(folder, flags.site, "Usage: assemblage sync [folder] [--site <site>]");
      await cmdSync(folder, site, Boolean(flags["json"]));
      break;
    }
    case "media":
      if (positional[0] !== "sync") {
        throw new Error("Usage: assemblage media sync [folder] [--site <site>] [--json]");
      }
      {
        const folder = resolve(positional[1] ?? ".");
        const site = await siteIdentifierForFolder(folder, flags.site, "Usage: assemblage media sync [folder] [--site <site>] [--json]");
        await cmdMediaSync(folder, site, Boolean(flags["json"]));
      }
      break;
    case "invite":
      if (!positional[0])
        throw new Error("Usage: assemblage invite <email> [--site <site>]");
      await cmdInvite(positional[0], await siteIdentifierFromCurrentDirectory(flags.site, "Usage: assemblage invite <email> [--site <site>]"));
      break;
    case "join":
      if (!positional[0])
        throw new Error("Usage: assemblage join <invitation-link>");
      await cmdJoin(positional[0]);
      break;
    case "collaborators":
      await cmdCollaborators(await siteIdentifierFromCurrentDirectory(flags.site, "Usage: assemblage collaborators [--site <site>]"));
      break;
    case "remove-collaborator":
      if (!positional[0]) {
        throw new Error("Usage: assemblage remove-collaborator <email> [--site <site>]");
      }
      await cmdRemoveCollaborator(positional[0], await siteIdentifierFromCurrentDirectory(flags.site, "Usage: assemblage remove-collaborator <email> [--site <site>]"));
      break;
    case "resolve":
      if (!positional[0] || typeof flags.session !== "string" || typeof flags.choices !== "string") {
        throw new Error("Usage: assemblage resolve <folder> --session <file> --choices <file> [--json]");
      }
      await cmdResolve(resolve(positional[0]), flags.session, flags.choices, Boolean(flags["json"]));
      break;
    case "domain": {
      const [sub, domainArg] = positional;
      const site = await siteIdentifierFromCurrentDirectory(flags.site, "Usage: assemblage domain <add|status|remove> [--site <site>] [domain]");
      const cfg = configFromEnv();
      const target = await resolveSite(cfg, site);
      const siteId = target.siteId;
      switch (sub) {
        case "add":
          if (!domainArg)
            throw new Error("Usage: assemblage domain add <domain> [--site <site>]");
          printDomain(await api.attachDomain(cfg, siteId, domainArg), target.subdomain);
          break;
        case "status":
          printDomain(await api.domainStatus(cfg, siteId), target.subdomain);
          break;
        case "remove": {
          const { removed } = await api.removeDomain(cfg, siteId);
          console.log(`Disconnected ${removed}. The site stays live at its assemblage.place address.`);
          break;
        }
        default:
          throw new Error("Usage: assemblage domain <add|status|remove> [--site <site>] [domain]");
      }
      break;
    }
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
    case "admin":
      await cmdAdmin(positional, flags);
      break;
    default:
      console.log("Commands (--site is optional in a folder already bound to a site): sites | create [name] | rename <site> <name> | status [folder] [--site <site>] | preview <folder> | publish [folder] [--site <site>] [--force] [--allow-server] | download [folder] [--site <site>] [--deploy <id>] | invite <email> [--site <site>] | join <invitation-link> | collaborators [--site <site>] | remove-collaborator <email> [--site <site>] | share [folder] [--site <site>] [--name <name>] [--email <email>] | sync [folder] [--site <site>] [--json] | media sync [folder] [--site <site>] [--json] | resolve <folder> --session <file> --choices <file> | domain <add|status|remove> [--site <site>] [domain] | claim <email> | whoami | admin <sub>");
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
