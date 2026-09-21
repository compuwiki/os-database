# Data

Everything the page shows lives here as plain JSON. The page loads these files at startup (`js/data.js`), so it has to be served over HTTP.

```
data/
  meta.json          dataAsOf + systemFiles: the systems files to load, in display order
  authors.json       every author: { "type": <author kind>, "logo"?: file in assets/author/, "parent"?: owner company }
  taxonomy/          the filter definitions (each key is what systems refer to)
    base-types.json    Base OS pills (kernel lineage), with logo/icon, color, hint
    families.json      Linux distro families (Debian based, Arch based, ...)
    based-on.json      "Based on" upstreams
    device-types.json  Server, Desktop, Mobile, ...
    license-types.json license families (GPL, MIT / BSD, ...)
    install-tiers.json install ranges: key -> range text, highest first
    author-kinds.json  Companies, Foundations & non-profits, Community projects, Independent developers
  systems/           one file per Base OS; Linux is split by distro family (systems/linux/<family>.json)
  schema/            JSON Schema for the systems files (VS Code picks it up via .vscode/settings.json)
```

## Adding a system

1. Add an object to the right file in `systems/` (see `schema/systems.schema.json` for every field).
2. Every name you use in `by`, `basedOn`, `devices`, `licenseTags`, `installs`, `baseOS` and `distroBase` must exist in `authors.json` or `taxonomy/`; add it there first if it is new.
3. Drop the logo into `assets/logos/` (optimize with `npx svgo -f assets/logos --multipass`) and set `"logo"`, or omit it for an initials tile.
4. Run `node scripts/validate-data.mjs`.

Adding a whole new Base OS or family means adding its key to `taxonomy/`, creating the matching systems file, and listing that file in `meta.json`.
