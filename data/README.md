# Data

Everything the page shows lives here as plain JSON. The page loads these files at startup (`js/data.js`), so it has to be served over HTTP.

```
data/
  meta.json          dataAsOf + systemFiles: the systems files to load, in display order
  authors.json       every author: { "type": <author kind>, "logo"?: file in assets/author/, "parent"?: owner company }
  taxonomy/          the filter definitions (each key is what systems refer to)
    base-types.json    Base OS pills (the OS family), with logo/icon, color, hint
    families.json      Linux distro families: color for the initials tile (card tag = the family key)
    based-on.json      "Based on" upstreams (Debian based, Ubuntu based, FreeBSD based, Darwin based...); multi-valued
    unix-status.json   Certified UNIX / UNIX-like / Not UNIX
    generations.json   kernel generations for versioned families (NT 5 / NT 6 / NT 10); a system's optional `generation`
    device-types.json  Server, Desktop, Mobile, ...
    license-types.json license families (GPL, MIT / BSD, ...)
    install-tiers.json install ranges: key -> range text, highest first
    author-kinds.json  Companies, Foundations & non-profits, Community projects, Independent developers
  systems/           one file per Base OS; Linux is split by distro family (systems/linux/<family>.json)
  schema/            JSON Schema for the systems files (VS Code picks it up via .vscode/settings.json)
```

## Adding a system

1. Add an object to the right file in `systems/` (see `schema/systems.schema.json` for every field).
2. Every name you use in `by`, `basedOn`, `unix`, `devices`, `licenseTags`, `installs`, `baseOS` and `distroBase` must exist in `authors.json` or `taxonomy/`; add it there first if it is new.
   Open vs proprietary is one or the other (the validator enforces it): `source` `closed` means `licenseTags` is exactly `["Proprietary"]`, `open-source` means it has license families and no `Proprietary`. Mixed products (RHEL binaries under a subscription, KaiOS with proprietary services, Junos with BSD parts) go by their main nature, and the nuance goes into the `license` text.
3. Drop the logo into `assets/logos/` (optimize with `npx svgo -f assets/logos --multipass`) and set `"logo"`, or omit it for an initials tile.
4. Run `node scripts/validate-data.mjs`.

Adding a whole new Base OS or family means adding its key to `taxonomy/`, creating the matching systems file, and listing that file in `meta.json`.

## Editorial fields

`knownFor` (2 to 4 words, required) and `pitch` (one sentence, optional) are opinion, not specification: what each system is best known for, in the voice "Give me X and I'll Y". Keep `knownFor` neutral and factual in spirit ("Immutable, rollback-safe"), and use `pitch` for personality. They are shown in the detail dialog and the comparison, and are searchable.

## How systems are classified

Three independent facts, so nothing has to be squeezed into one label:

- **`baseOS`** is the OS family and drives the top row of pills (Windows NT, macOS, Linux, Android-based, iOS-based, BSD, UNIX, Other UNIX-like, Other). Every system has exactly one.
- **`basedOn`** lists every upstream it descends from, and can hold several: Android is `Linux kernel` + `Android (AOSP)`, macOS is `Darwin (XNU)` + `FreeBSD`, Ubuntu is `Linux kernel` + `Debian` + `Ubuntu`. This drives the "Based on" row.
- **`generation`** (optional) is the kernel generation inside a versioned family, for example Windows XP = `NT 5`, Windows 7 = `NT 6`, Windows 10 / 11 / Server = `NT 10`. It drives the "Generation" row, which appears when the selected Base OS spans several generations, and is shown in the detail dialog and comparison.
- **`unix`** is the UNIX heritage: `certified` (passed the UNIX certification: macOS, Solaris, AIX, HP-UX, z/OS), `like` (Linux, BSD, Android...) or `none` (Windows NT, DOS, Haiku, Fuchsia...). It is shown in the detail dialog and the comparison, not as a filter.
