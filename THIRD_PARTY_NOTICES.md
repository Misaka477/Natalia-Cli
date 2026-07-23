# Third-Party Notices

Natalia CLI is licensed under Apache-2.0. It uses the third-party software below. This inventory describes the dependencies locked for the first TypeScript/Bun release. License texts included in installed packages are collected in `THIRD_PARTY_LICENSES.txt`; packages whose npm artifacts omit a standalone license file remain identified there by exact package, version, and declared SPDX license.

## Direct Runtime Dependencies

| Package | Version | License | Source |
|---|---:|---|---|
| `@opentui/core` | 0.4.3 | MIT | <https://github.com/anomalyco/opentui> |
| `@opentui/keymap` | 0.4.3 | MIT | <https://github.com/anomalyco/opentui> |
| `@opentui/solid` | 0.4.3 | MIT | <https://github.com/anomalyco/opentui> |
| `solid-js` | 1.9.12 | MIT | <https://github.com/solidjs/solid> |
| `zod` | 3.25.76 | MIT | <https://github.com/colinhacks/zod> |
| `fuzzysort` | 3.1.0 | MIT | <https://github.com/farzher/fuzzysort> |

OpenTUI includes platform-specific native packages built from its Zig core. The locked OpenTUI core and platform packages declare the MIT license.

## Direct Development Dependencies

| Package | Version | License | Source |
|---|---:|---|---|
| `typescript` | 5.8.2 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `prettier` | 3.6.2 | MIT | <https://github.com/prettier/prettier> |
| `@types/bun` | 1.3.13 | MIT | <https://github.com/oven-sh/bun> |
| `@tsconfig/bun` | 1.0.9 | MIT | <https://github.com/tsconfig/bases> |

## Transitive Dependency Licenses

The locked dependency tree currently contains packages under these licenses:

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- BlueOak-1.0.0
- CC-BY-4.0 (`caniuse-lite` browser compatibility data)

No GPL, LGPL, or AGPL npm package was identified in the locked dependency tree at the time this notice was prepared.

Before each release, run `npm run licenses:check`. It validates workspace license metadata and regenerates the machine-derived dependency inventory used by the release artifact.

## System Components

Natalia invokes or uses system/runtime components that are not incorporated into Natalia source code:

- Bun runtime, primarily MIT with bundled third-party components under their respective licenses.
- Python, PSF License, currently used by the POSIX PTY bridge.
- GNU Bash, GPL-3.0-or-later, invoked as an external process.
- Git, GPL-2.0-only, invoked as an external process.
- SQLite, public domain, accessed through `bun:sqlite`.
- OpenSSL may be invoked by TLS tests and is not a normal runtime requirement.

Redistributors that bundle Bun, Python, Bash, Git, OpenSSL, or another system component with Natalia must also satisfy that component's distribution and source-notice obligations. Calling a separately installed executable does not incorporate that executable into Natalia.
