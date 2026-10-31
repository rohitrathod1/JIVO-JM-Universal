const fs = require('node:fs')
const before = JSON.parse(fs.readFileSync('audit-report.json', 'utf8'))
const after = JSON.parse(fs.readFileSync('audit-after.json', 'utf8'))
const runtimeContainers = new Set(['expo', 'react-native', 'expo-modules-core', '@react-native/virtualized-lists', 'react-native-reanimated', 'react-native-worklets'])
const rows = Object.entries(before.vulnerabilities).map(([name, item]) => {
  let version = 'see lockfile'
  try { version = JSON.parse(fs.readFileSync(item.nodes[0] + '/package.json', 'utf8')).version } catch {}
  const reach = name === 'uuid' || name === 'xcode' ? 'Xcode project-generation tool; caller uses v4 without an output buffer'
    : name === 'node-forge' || name === '@expo/code-signing-certificates' ? 'Expo CLI certificate/signature tooling; not imported by application source'
    : runtimeContainers.has(name) ? 'Runtime package present; audit finding inherited through tooling dependencies, not a direct runtime advisory'
    : 'Metro/Expo project-generation or build-tool dependency'
  const result = after.vulnerabilities[name] ? 'Unresolved; root advisory has no patched release. Keep dev tooling local; no force downgrade.'
    : 'Removed by scoped xcode → uuid 11.1.1 override; v4 compatibility checked.'
  return `| ${name} | ${version} | ${item.severity} | ${reach} | ${result} |`
})
const text = `# JIVO-063 dependency triage

Initial audit: 26 affected package entries (19 high, 7 moderate). These represent three underlying advisories, not 26 independent flaws.
After the scoped override: ${after.metadata.vulnerabilities.high} high, ${after.metadata.vulnerabilities.moderate} moderate.

## Underlying issues and remediation

- **braces <=3.0.3:** deeply nested patterns can exhaust the stack. The advisory lists no patched version. It is reached through Metro file matching / micromatch in this dependency tree. Application source does not use these functions on chat content.
  Source: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- **node-forge <=1.4.0:** malformed RSA PKCS#1 v1.5 signatures can be accepted. The advisory lists no patched version. Installed callers are Expo CLI and code-signing certificate tooling; the app has no forge-based authentication or signature verification.
  Source: https://github.com/advisories/GHSA-86w9-cpqp-85rv
- **uuid <11.1.1:** affected name-based UUID functions accept a caller-provided output buffer without sufficient bounds checking. The installed xcode 3.0.1 caller uses only uuid.v4() with no arguments. Applied the narrow package override \`xcode: { uuid: "11.1.1" }\`, retaining CommonJS compatibility. Verified xcode.generateUuid() still returns a 24-character uppercase hexadecimal ID. This removed all seven moderate inherited entries. No global UUID override or Expo/RN downgrade was applied.
  Source: https://github.com/advisories/GHSA-w5hq-g745-h8pq

## Reachability assessment

The classification below is an inference from the installed dependency paths and application imports. It is not a formal proof of every dynamically loaded module. npm marks Expo/RN runtime containers because their published dependency trees include build tooling; that alone does not show the vulnerable functions executing in an installed mobile application. No server is deployed by this project. Keep local development servers bound to loopback, avoid untrusted Metro glob/config inputs, and re-evaluate upstream patches before distribution. Outstanding advisories are not suppressed.

| Package | Installed version after remediation | Original severity | Observed role / reachability | Disposition |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

## Evidence and limits

- \`audit-report.json\`: initial audit.
- \`audit-after.json\`: audit after compatible override.
- \`package.json\` / \`package-lock.json\`: narrowly scoped dependency resolution.
- Xcode UUID caller smoke test passed; source typecheck, lint and unit tests are checked separately.
- Platform builds/exports are stopped per the user's source-only instruction. No iOS build compatibility claim is made.
- No backend or original frontend dependency changes.
`
fs.writeFileSync('DEPENDENCY-TRIAGE.md', text)
console.log(`Wrote triage for ${rows.length} entries`)
