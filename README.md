# OS & Distro Directory

A static, single-page directory of operating systems: Windows, macOS, Linux distributions, BSDs, mobile, TV, automotive, embedded and retro systems. Browse, filter, and compare up to 10 systems side by side.

No build step and no backend, just static files. The page loads its data from JSON, so it has to be served over HTTP (it does not work when `index.html` is opened directly from disk):

```
python -m http.server     # then open http://localhost:8000
```

It also loads Tailwind from its CDN, so it needs an internet connection.

## Features

- **Search** across names, kernels, desktops, package managers, file systems, licenses and authors (press `/` to focus).
- **Filters** that combine with each other:
  - **Base OS**: Android, iOS, Linux, macOS, Windows, Windows (pre-NT), BSD, OS/2, UNIX, UNIX-like, Independents
  - **Year of creation**: dual-thumb range slider over each system's `released` year
  - **Generation**: kernel generation for versioned families, for example Windows NT 5 (XP), NT 6 (7) and NT 10 (10, 11, Server) or Windows 3.x (Win16) and Windows 9x; shown when the selected Base OS has several
  - **Device**: Server, Desktop, Mobile, TV, Wearable, Automotive, Embedded, Network (routers and firewalls), Console, VR headset, Robot
  - **Lifecycle**: Active, Maintenance only, Discontinued
  - **License**: Proprietary or Open Source, with families (GPL, MIT / BSD, Apache, MPL / CDDL) under Open Source
  - **Installs (est.)**: 1B+, 100M+, 10M+, 1M+, 100K+, 10K+, <10K (each system is in exactly one range)
  - **Based on**: every upstream a system descends from, so a system can match several: Android, Darwin, Arch, Debian, Ubuntu, Fedora, Slackware, Gentoo, SUSE, Alpine, NixOS, Windows NT, MS-DOS, FreeBSD, NetBSD, OS/2, System V (same order pattern as Base OS; no Linux kernel pill). Only options that narrow the selected Base OS are shown
  - **Author**: who actually makes a system, in four categories (Companies, Foundations & non-profits, Community projects, Independent developers); picking a category lists its authors. Owners are shown, for example Red Hat (IBM). Only categories and authors with systems in the selected Base OS are listed
  - Secondary filters collapse behind **More filters** (long pill rows show a **+N more** toggle)
- **Known for / pitch**: a short editorial line for every system ("Freedom & control", "Give me Linux and I'll make it do anything."), shown in the dialog and the comparison, and searchable
- **Detail dialog** with UNIX heritage (certified UNIX / UNIX-like / not UNIX), CPU support, kernel, bootloader, file systems, graphics and audio stack, desktop, package manager, default shell (bash, zsh, PowerShell...), userland / core tools (GNU, BusyBox, BSD...), license and more.
- **Comparison table**: add up to 10 systems with the `+` button on each card, then compare them in columns. Rows that differ are highlighted.
- **More to explore**: external links to the OS Family Tree and DistroWatch Search

## Project layout

```
index.html        page markup
css/styles.css    styles (Tailwind handles the rest)
js/app.js         entry point: filtering, rendering, detail dialog, comparison
js/data.js        loads everything under data/ and returns it as one object
js/icons.js       UI icons (stroke SVG paths)
data/             all the content as JSON (see data/README.md)
assets/logos/     logo of each system
assets/author/    logo of each author
scripts/          validate-data.mjs: consistency check for data/
```

## Editing the data

All content is JSON under `data/`: systems (one file per Base OS, Linux split by family), authors and the filter definitions. See [data/README.md](data/README.md) for the layout and the steps to add a system, and `data/schema/systems.schema.json` for every field (VS Code validates and autocompletes it).

After editing, run the consistency check (Node 18+, no dependencies):

```
node scripts/validate-data.mjs
```

It verifies that every author, filter key and logo file a system refers to exists, that each system sits in the right file, and lists unused logo files.

To keep logos small, optimize them with [SVGO](https://github.com/svg/svgo): `npx svgo -f assets/logos --multipass`.

## About the data

- Kernel and release versions are as of **September 2026**. Systems without a version could not be confirmed.
- **Install counts are rough estimates**, not measurements. They count active installs: devices, physical servers and long-lived VMs (not short-lived containers), so server distros are counted by machines rather than people.
- "Known for" and the one-line pitches are editorial opinion, not specifications.
- Specs, licenses and authors were compiled by hand and may contain mistakes. Corrections are welcome.

## Credits

- Logos are trademarks of their respective owners and are used here only to identify each system. Many come from [simple-icons](https://simpleicons.org) (CC0) and [Iconify](https://iconify.design).
- UI icons are from [Feather](https://feathericons.com) (MIT).
