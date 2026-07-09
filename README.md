# assemblage-skill

The public, install-ready home of the **Assemblage** agent skill — folder-first
publishing for agent-made sites.

Install it into your agent with one command:

```bash
npx skills add General-Sentiment/assemblage-skill --skill assemblage-publish -g
```

That installs the skill **and** the `assemblage` CLI it drives (they ship
together in `skills/assemblage-publish/`). No npm? Use the installer instead:

```bash
curl -fsSL https://assemblage.chat/install.sh | bash
```

## What's here

```
skills/
  assemblage-publish/
    SKILL.md        # the skill
    assemblage.mjs  # the CLI, as one self-contained bundle
```

## This repo is generated — don't hand-edit

Both files are built from the private `assemblage` source repo and pushed here by
its `clients/skill/sync-public.sh`. Edit the skill or CLI there, run the sync, and
the change lands here. Nothing else about the source (API, infra, protocol) is
public — only these two artifacts, which contain no secrets.
