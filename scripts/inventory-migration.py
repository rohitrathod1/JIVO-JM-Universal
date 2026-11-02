"""Read-only source inventory. Output stays in Universal; never loads app secrets."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
reference = root.parent / 'JIVO-JM-Frontend'


def inventory(project):
    entries = []
    paths = sorted([*project.joinpath('src').rglob('*'), *project.joinpath('public').rglob('*')])
    for path in paths:
        if not path.is_file():
            continue
        relative = path.relative_to(project).as_posix()
        content = path.read_bytes()
        entry = {'path': relative, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
        if path.suffix in {'.ts', '.tsx', '.css'}:
            source = content.decode('utf-8-sig')
            entry['exports'] = re.findall(r'\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|enum)\s+(\w+)', source)
            if path.name == 'module.config.tsx' or path.name == 'AppRoutes.tsx':
                uncommented = re.sub(r'^\s*//.*$', '', source, flags=re.M)
                entry['routes'] = sorted(set(re.findall(r'''\bpath\s*(?::|=)\s*['"]([^'"]+)['"]''', uncommented)))
            if path.name == 'api.ts' or relative.startswith('src/core/auth/security'):
                entry['apiPathLiterals'] = sorted(set(re.findall(r'''(?:api\.(?:get|post|put|patch|delete)(?:<[^;\n]*?>)?\s*\(\s*)(['"`])([^'"`]+)\1''', source)))
        entries.append(entry)
    package = json.loads(project.joinpath('package.json').read_text(encoding='utf-8-sig'))
    return {'files': entries, 'dependencies': package.get('dependencies', {}), 'devDependencies': package.get('devDependencies', {})}


report = {'capturedAt': datetime.now(timezone.utc).isoformat(), 'scope': 'Read-only source snapshot; lexical exports/routes, not execution or behavior equivalence',
          'reference': inventory(reference), 'universal': inventory(root)}
destination = root / 'docs' / 'migration-inventory-2026-11-02.json'
destination.write_text(json.dumps(report, indent=2), encoding='utf-8')
for name in ['reference', 'universal']:
    section = report[name]
    print(f"{name}: {len(section['files'])} source/public files, {len(section['dependencies'])} runtime dependencies")
print(destination.relative_to(root))
