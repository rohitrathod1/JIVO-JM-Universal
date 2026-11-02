# Current dependency checkpoint — 2026-10-21T05:40:43.143Z

Full and omit-dev audits: **20 high, 0 moderate/critical**, SDK compatibility passes. The added exact SDK-supported react-native-view-shot 6.1.1 entry inherits react-native; it is not a new direct advisory root. npm proposes view-shot 4.0.3 (major downgrade) or Expo/RN major downgrades; none was applied. Root advisories remain braces <=3.0.3 (GHSA-vfj7-8cjw-p6xm) and node-forge <=1.4.0 (GHSA-86w9-cpqp-85rv); current registry versions still fall in those ranges. No safe compatible remediation identified.

Installed packages include native runtime modules, while the observed advisory paths lead through existing toolchain dependencies. Omit-dev includes those tools; it does not prove runtime exclusion. No native build/export or reachability proof was performed. See audit-current.json, audit-production-current.json, dependency-paths-current.json and sdk-compatibility-current.log. Earlier 19-entry counts below are historical.

# JIVO-063 dependency triage

Initial audit: 26 affected package entries (19 high, 7 moderate). These represent three underlying advisories, not 26 independent flaws.
After the scoped override: 19 high, 0 moderate.

## Underlying issues and remediation

- **braces <=3.0.3:** deeply nested patterns can exhaust the stack. The advisory lists no patched version. It is reached through Metro file matching / micromatch in this dependency tree. Application source does not use these functions on chat content.
  Source: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- **node-forge <=1.4.0:** malformed RSA PKCS#1 v1.5 signatures can be accepted. The advisory lists no patched version. Installed callers are Expo CLI and code-signing certificate tooling; the app has no forge-based authentication or signature verification.
  Source: https://github.com/advisories/GHSA-86w9-cpqp-85rv
- **uuid <11.1.1:** affected name-based UUID functions accept a caller-provided output buffer without sufficient bounds checking. The installed xcode 3.0.1 caller uses only uuid.v4() with no arguments. Applied the narrow package override `xcode: { uuid: "11.1.1" }`, retaining CommonJS compatibility. Verified xcode.generateUuid() still returns a 24-character uppercase hexadecimal ID. This removed all seven moderate inherited entries. No global UUID override or Expo/RN downgrade was applied.
  Source: https://github.com/advisories/GHSA-w5hq-g745-h8pq

## Reachability assessment

The classification below is an inference from the installed dependency paths and application imports. It is not a formal proof of every dynamically loaded module. npm marks Expo/RN runtime containers because their published dependency trees include build tooling; that alone does not show the vulnerable functions executing in an installed mobile application. No server is deployed by this project. Keep local development servers bound to loopback, avoid untrusted Metro glob/config inputs, and re-evaluate upstream patches before distribution. Outstanding advisories are not suppressed.

| Package | Installed version after remediation | Original severity | Observed role / reachability | Disposition |
| --- | --- | --- | --- | --- |
| @expo/cli | 58.1.13 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| @expo/code-signing-certificates | 0.0.7 | high | Expo CLI certificate/signature tooling; not imported by application source | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| @expo/config | 58.0.6 | moderate | Metro/Expo project-generation or build-tool dependency | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |
| @expo/config-plugins | 58.0.9 | moderate | Metro/Expo project-generation or build-tool dependency | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |
| @expo/inline-modules | 0.2.6 | moderate | Metro/Expo project-generation or build-tool dependency | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |
| @expo/local-build-cache-provider | 58.0.6 | moderate | Metro/Expo project-generation or build-tool dependency | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |
| @expo/metro | 58.0.0 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| @expo/metro-config | 58.0.15 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| @expo/prebuild-config | 58.0.14 | moderate | Metro/Expo project-generation or build-tool dependency | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |
| @react-native/community-cli-plugin | 0.88.0 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| @react-native/metro-config | 0.88.0 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| @react-native/virtualized-lists | 0.88.0 | high | Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| braces | 3.0.3 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| expo | 58.0.16 | high | Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| expo-modules-core | 58.0.23 | high | Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| metro | 0.87.1 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| metro-config | 0.87.1 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| metro-file-map | 0.87.1 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| metro-transform-worker | 0.87.1 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| micromatch | 4.0.8 | high | Metro/Expo project-generation or build-tool dependency | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| node-forge | 1.4.0 | high | Expo CLI certificate/signature tooling; not imported by application source | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| react-native | 0.88.0 | high | Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| react-native-reanimated | 4.7.1 | high | Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| react-native-worklets | 0.13.0 | high | Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory | Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade. |
| uuid | 11.1.1 | moderate | Xcode project-generation tool; caller uses v4 without an output buffer | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |
| xcode | 3.0.1 | moderate | Xcode project-generation tool; caller uses v4 without an output buffer | Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked. |

## Evidence and limits

- `audit-report.json`: initial audit.
- `audit-after.json`: audit after compatible override.
- `package.json` / `package-lock.json`: narrowly scoped dependency resolution.
- Xcode UUID caller smoke test passed; source typecheck, lint and unit tests are checked separately.
- Platform builds/exports are stopped per the user's source-only instruction. No iOS build compatibility claim is made.
- No backend or original frontend dependency changes.

## Recheck after playback modules

The fresh audit in `audit-after-media.json` still reports 19 high entries and no moderate/critical entries. Reviewed braces and node-forge advisories still list no patched versions; npm's proposed Expo 44.0.6 downgrade is not a compatible remediation. `npx expo install --check` passes. No force fix, suppression, or new override was applied. Latest authoritative advisory links are recorded in JIVO-063-STATUS.md.

## Review-fix checkpoint 2026-10-20T08:24:16.508Z

No dependencies or lockfile were changed during the review fixes. The audit recorded at 07:40:34 UTC remains 19 high, zero moderate and zero critical entries, rooted in the braces and node-forge advisories described above. The previously completed SDK compatibility check passed. No force fix, incompatible Expo downgrade, suppression, new override, build or export was performed. This assessment is not proof that affected tooling is unreachable in every shipped artifact.

## Fresh reassessment 2026-10-20T08:28:03.953Z

Full audit: 19 high. npm --omit=dev also reports 19 high because Expo/RN publish CLI/tooling dependencies within their production dependency trees; omit=dev is not a shipped-bundle reachability analysis. Registry latest releases: braces 3.0.3, node-forge 1.4.0. Both remain affected and their advisories list no patched releases. SDK compatibility check: passed, dependencies up to date. No compatible upstream fix is available in this tree. npm's Expo 44.0.6 / RN 0.72.17 downgrade proposals are incompatible with SDK 58 and were not applied. Existing scoped UUID remediation remains.

Evidence: audit-current.json, audit-production-current.json, dependency-paths-current.json, sdk-compatibility-current.log. Application source has no imports of braces/micromatch/node-forge; observed callers are Metro file matching and Expo signing/certificate tooling. Runtime non-exposure remains an inference, not proven without artifact analysis (builds/exports prohibited).

| Package | Installed | Advisory or inherited path | Observed classification |
|---|---|---|---|
| @expo/cli | 58.1.13 | @expo/code-signing-certificates; @expo/metro; @expo/metro-config; node-forge | Development/build tooling path |
| @expo/code-signing-certificates | 0.0.7 | node-forge | Development/build tooling path |
| @expo/metro | 58.0.0 | metro; metro-config; metro-file-map; metro-transform-worker | Development/build tooling path |
| @expo/metro-config | 58.0.15 | @expo/metro | Development/build tooling path |
| @react-native/community-cli-plugin | 0.88.0 | @react-native/metro-config; metro | Development/build tooling path |
| @react-native/metro-config | 0.88.0 | metro-config | Development/build tooling path |
| @react-native/virtualized-lists | 0.88.0 | react-native | Runtime container with inherited tooling finding |
| braces | 3.0.3 | braces: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm | Development/build tooling path |
| expo | 58.0.16 | @expo/cli; @expo/metro; @expo/metro-config; expo-modules-core | Runtime container with inherited tooling finding |
| expo-modules-core | 58.0.23 | react-native-worklets | Runtime container with inherited tooling finding |
| metro | 0.87.1 | metro-config; metro-file-map; metro-transform-worker | Development/build tooling path |
| metro-config | 0.87.1 | metro | Development/build tooling path |
| metro-file-map | 0.87.1 | micromatch | Development/build tooling path |
| metro-transform-worker | 0.87.1 | metro | Development/build tooling path |
| micromatch | 4.0.8 | braces | Development/build tooling path |
| node-forge | 1.4.0 | node-forge: https://github.com/advisories/GHSA-86w9-cpqp-85rv | Development/build tooling path |
| react-native | 0.88.0 | @react-native/community-cli-plugin; @react-native/virtualized-lists | Runtime container with inherited tooling finding |
| react-native-reanimated | 4.7.1 | react-native; react-native-worklets | Runtime container with inherited tooling finding |
| react-native-worklets | 0.13.0 | @react-native/metro-config; react-native | Runtime container with inherited tooling finding |

## Native export dependency checkpoint

Added only exact SDK-supported expo-file-system 58.0.10 and expo-sharing 58.0.19 with npm install --ignore-scripts. No build, force fix or advisory suppression ran. Refreshed audit-current.json and audit-production-current.json both report 19/19 high entries, zero moderate/critical; the same braces/node-forge roots remain. Expo install --check passes. Installed native sharing source was reviewed to avoid iOS type-adjustment staging. Module wiring is source/mock tested and requires actual native validation.

### Source parity pass reassessment (2026-10-20T10:31:24.094Z)

No package.json or package-lock.json edits in this pass. Refreshed audit-current.json and audit-production-current.json both report 19 high, zero moderate/critical; sdk-compatibility-current.log reports dependencies up to date. The two upstream advisory ranges and exposure qualifications above still apply. No forced fix, suppression or unsafe override was added.

## Final capture/editor dependency recheck - 2026-10-20T11:17:26.969Z

Added exact Expo SDK 58 bundled versions expo-image-manipulator 58.0.15 and expo-contacts 58.0.8 with install scripts disabled. npm audit --json and npm audit --omit=dev --json both report 19 high, 0 moderate/critical; Expo install --check reports dependencies up to date. Latest registry braces 3.0.3 and node-forge 1.4.0 remain within the advisory ranges listed above. No compatible safe fix was identified. Audit exit 1 indicates unresolved advisories, not successful remediation. Native runtime reachability remains unproven; omit-dev includes toolchain dependencies. No forced downgrade, suppression, account or paid service was introduced.
