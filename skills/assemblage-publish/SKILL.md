---
name: assemblage-publish
description: Publish, preview, check, or restore an assemblage site — a folder-first static site where big media only ever uploads once and only changed files re-upload. Use whenever someone says "publish my site," "publish this folder," "put this online," "deploy this site," "preview my site," "what changed on my site," "restore my site files," or asks about their assemblage sites. Works on any folder containing a site (plain HTML or with a build step — the tool detects which and says what it decided).
---

# assemblage — publish

The site is a folder. Publishing puts it online at `https://{name}.assemblage.place`.
Only changed files ever upload, so re-publishing after an edit is instant even when
the folder holds gigabytes of video.

## Who you're talking to

Assume the person is **not technical**. They think in terms of "my site," "put it
online," "what changed" — not commands, site IDs, credentials, or build tools. Your
job is to make publishing feel like a conversation, not a terminal session.

**Communication rules — follow these unless the user asks otherwise:**

- **Never mention the CLI, commands, flags, `siteId`s, credentials, tokens, or build
  tooling** in what you say to the user. Those are how *you* do the work (see below),
  not part of the conversation.
- Talk about outcomes: the site's name, its live URL, what changed, what's now online.
- The one technical detail you **do** always surface is the **resolution line** — e.g.
  "Publishing ./dist (built with astro)" — but say it plainly: "I'll publish the built
  version of your site." Intuition with disclosure is part of the product.
- When you need something from the user, ask a plain-language question ("What would you
  like to call it?"), not a request to run or configure anything.
- Only if the user **explicitly** asks about the CLI, the internals, or "how does this
  work under the hood" should you talk about commands. Then be as detailed as they want.

**How to tell users to do things:** they drive everything by *talking to you*. So when
you explain what's possible, phrase it as things they can say, e.g.:

- "Publish this folder" / "put this online"
- "Preview my site first"
- "What changed since I last published?"
- "Rename it to `<something>`"
- "Claim this site under my email so it's mine"
- "Download the live version back into this folder"

Never tell a user to run a command themselves.

## Safety — one folder is one site (read this before every publish)

**A folder maps to exactly one site.** The folder you're publishing *from* is the
identity of the site. Never publish a folder to a site that a *different* folder
created — that replaces someone's live site with unrelated contents, and it is the
single worst thing this tool can do. Treat it like `rm` on the wrong directory.

**How to know which site a folder belongs to — do this, don't guess:**

1. Look in the folder for `.assemblage/binding.json`. If it's there, that is the
   folder's site. "Publish"/"publish again" means re-publish to *that* site. Done.
2. If there is **no** `.assemblage/` binding, the folder has **no site yet**. It is a
   **new** site → ask what to call it and create one (see Naming). 
3. **Never** pick a site out of `assemblage sites` for a folder that isn't already
   bound to it. The site list is not a menu for choosing where a folder publishes —
   it's just an inventory. Two folders with similar names are still two different
   sites.

**If `publish` refuses** (it will say it's "refusing to overwrite" a site because the
folder has never been published there): that is the safety net catching a
mis-target. **Stop. Do not add `--force`.** Almost always the right move is to create
a *new* site for this folder instead. Only ever pass `--force` if, in this same
conversation, the user has explicitly said they want to *replace that specific named
site* with this folder — never on your own initiative, and never to make an error
message go away. When in doubt, ask the user in plain language which site they mean.

## How you do the work (internal — do not surface)

Behind the scenes you drive the `assemblage` CLI. It needs **no configuration** — on
first use it mints a per-device credential (`~/.assemblage/credentials.json`) and has
the production API URL baked in. Resolve the CLI in this order and use whichever works:

1. `assemblage` if it's on the PATH (the `curl … | bash` installer puts it there).
2. Otherwise the bundle shipped **inside this skill's own directory** — the
   `npx skills add` install drops `assemblage.mjs` right next to this SKILL.md:
   `node "<this-skill-dir>/assemblage.mjs" <command>`.
3. Only when you're working inside the source repo: `node <repo>/clients/skill/dist/cli.js`
   (build first if `dist/` is missing: `pnpm install && pnpm build` in the repo root).

```bash
assemblage <command>          # or: node "<this-skill-dir>/assemblage.mjs" <command>
```

- Overrides (rarely needed): `ASSEMBLAGE_TOKEN` (a specific account / the admin token)
  and `ASSEMBLAGE_API_URL` (point at another environment).

| What the user is asking for | Command you run |
|---|---|
| "List my sites" | `assemblage sites` |
| "Is this mine / claim status" | `assemblage whoami` |
| "Create a site" | `assemblage create [name]` — name optional; omitted → generated |
| "Rename it" | `assemblage rename <siteId> <new-name>` |
| "What changed?" | `assemblage status <folder> --site <siteId>` |
| "Preview it first" | `assemblage preview <folder>` then open the printed localhost URL |
| "Publish it" | `assemblage publish <folder> --site <siteId>` — the `<siteId>` must be the one this folder is bound to (see Safety) |
| "Replace site X with this folder (explicit)" | `assemblage publish <folder> --site <siteId> --force` — **only** after the user explicitly confirms replacing that named site |
| "Restore / download it" | `assemblage download <folder> --site <siteId> [--deploy <id>]` |
| "Claim it under my email" | `assemblage claim <email>` |

## Typical flow (publishing a folder)

1. Check the folder for a site binding (`.assemblage/binding.json`). If none, the
   folder has no site yet — ask what to call it (see Naming), then create it. Behind
   the scenes: `assemblage create`. If a binding exists, use that `siteId` — this is
   a re-publish, not a new site.
2. Publish it. Behind the scenes: `assemblage publish . --site <siteId>` — where
   `<siteId>` is the folder's bound site (never one guessed from the site list).
3. Tell the user it's live and give them the URL. Mention the resolution line in plain
   language (e.g. "I published the built version").
4. Re-publishing after edits is the same for them — "publish again" — and only changed
   files upload, so it's fast.

## Behavior notes

- **Always relay the resolution line in plain language** (e.g. "I'll publish the built
  version of your site, made with Astro") — never as raw command output.
- `publish` runs any detected/configured build first, uploads only missing blobs,
  finalizes, and flips the site live. Give the user the live URL it prints. On success
  it records the folder→site binding (`.assemblage/binding.json`) so future publishes
  from this folder always go to the right site. It **refuses** to overwrite a live site
  the folder has never published to — see Safety for how to handle that (don't `--force`
  reflexively).
- `status` is offline-safe (diffs against `.assemblage/<siteId>.json`). Report changes
  as "3 pages changed, 1 image added" — not as raw diff lines.
- `download` never deletes local files; it lists local-only files (`?` lines) and leaves
  them. Tell the user in plain terms about any files that exist only on their computer.
- A `site.json` in the folder root (keys: `name`, `dir`, `build`, all optional) overrides
  detection. If you guessed wrong and the user corrects you, offer to remember it — you'll
  write `site.json` for them; you don't need to explain the file unless they ask.

## Identity & ownership

- Publishing **just works** with no signup — the person already has an anonymous account
  tied to this computer, and their sites are private to them. Never make signup sound like
  a prerequisite.
- If they want to make a site truly theirs — so they can recover it later or move it to
  another computer — they can **claim it under their email**. You send the claim; they
  click a link in the email that arrives. That's the whole story for the user; don't
  surface the command or the token. Behind the scenes: `assemblage claim <email>`, status
  via `assemblage whoami`.

## Naming

- Sites live at `https://{name}.assemblage.place`.
- **When publishing a folder that has no site yet, ask the user what to call it** (one
  plain question, suggest a default). If they shrug, create without a name — the server
  generates one like `cedar-hollow-47` — and let them know they can rename anytime just by
  asking.
- The server normalizes whatever they answer: "My Cool Site!" → `my-cool-site`. Don't
  lecture about subdomain rules; just show the resulting URL. Only if normalization changes
  the name significantly, mention it in passing.
- Renaming is just "rename it to X" for the user. Behind the scenes:
  `assemblage rename <siteId> <new-name>` — the old subdomain stops resolving, so if the
  site is already live, tell the user the old address will stop working.
