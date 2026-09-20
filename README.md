# OS & Distro Directory

A static, single-page directory of operating systems: Windows, macOS, Linux distributions, BSDs, mobile, TV, automotive, embedded and retro systems. Browse, filter, and compare up to 10 systems side by side.

No build step and no backend. Open `index.html` in a browser (the page loads Tailwind from its CDN, so it needs an internet connection).

## Features

- **Search** across names, kernels, desktops, package managers, file systems, licenses and authors (press `/` to focus).
- **Filters** that combine with each other:
  - **Base OS**: Windows NT, macOS, Linux, Android-based, iOS-based, BSD, UNIX, UNIX-like, Other
  - **Distro base** (Linux only): Debian, Arch, Red Hat / Fedora, Slackware, Gentoo, SUSE, Alpine, Independent
  - **Device**: Desktop, Server, Mobile, TV, Wearable, Automotive, Embedded
  - **License**: Proprietary or Open Source, with families (GPL, MIT / BSD, Apache, MPL / CDDL) under Open Source
  - **Users (est.)**: 1B+, 100M+, 10M+, 1M+, 100K+, 10K+, <10K (each system is in exactly one range)
  - **Author / upstream**: company, organization or developer, including the projects a system is built on; only authors with systems in the selected Base OS are listed
- **Detail dialog** with CPU support, kernel, bootloader, file systems, graphics and audio stack, desktop, package manager, default shell (bash, zsh, PowerShell...), userland / core tools (GNU, BusyBox, BSD...), license and more.
- **Comparison table**: add up to 10 systems with the `+` button on each card, then compare them in columns. Rows that differ are highlighted.

## Project layout

```
index.html        page markup
css/styles.css    styles (Tailwind handles the rest)
js/data.js        all the data: systems, authors, filter definitions
js/app.js         filtering, rendering, comparison
js/icons.js       UI icons (stroke SVG paths)
assets/logos/     logo of each system
assets/author/    logo of each author
```

## Editing the data

Everything lives in `js/data.js`. To add a system, append an object to `osData`:

```js
{ id: "example-os", name: "Example OS", baseOS: "Linux", distroBase: "Debian",
  by: ["Example Project", "Debian Project", "Linux Foundation"],  // author first, then upstream
  devices: ["Desktop"], users: "10K+",
  license: "GPL-2.0", licenseTags: ["GPL"],
  logo: "example-os.svg",                                        // file in assets/logos/, or omit
  source: { type: "open-source", url: "https://example.org/repo" }, // or { type: "closed" }
  specs: { cpuCompatibility: ["x86_64"], kernel: "Linux", bootloader: ["GRUB2"], fileSystems: ["ext4"],
           graphicServer: ["Wayland"], audioServer: ["PipeWire"], desktopEnvironment: ["GNOME"], packageManager: ["apt"] } }
```

- `baseOS` must be a key of `baseTypes`; `distroBase` (Linux only) a key of `families`.
- Every name in `by` must exist in `authors`. Add a new author there if needed.
- Without a `logo`, the card shows the system's initials.
- Filter pills are generated from the data, so new values appear automatically.

To keep logos small, optimize them with [SVGO](https://github.com/svg/svgo): `npx svgo -f assets/logos --multipass`.

## About the data

- Kernel and release versions are as of **September 2026**. Systems without a version could not be confirmed.
- **User counts are rough estimates** of active users or devices, not measurements.
- Specs, licenses and authors were compiled by hand and may contain mistakes. Corrections are welcome.

## Credits

- Logos are trademarks of their respective owners and are used here only to identify each system. Many come from [simple-icons](https://simpleicons.org) (CC0) and [Iconify](https://iconify.design).
- UI icons are from [Feather](https://feathericons.com) (MIT).
