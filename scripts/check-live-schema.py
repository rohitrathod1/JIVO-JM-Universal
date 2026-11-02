"""Read-only preflight for the pre-existing isolated smoke database. Never migrates."""
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root.parent / 'JIVO-JM-Backend'))
if not os.environ.get('DB_NAME', '').startswith('test_'):
    raise RuntimeError('An explicit test_ database is required.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.apps import apps
from django.conf import settings
from django.db import connection

assert settings.DATABASES['default']['NAME'].startswith('test_')
missing = []
with connection.cursor() as cursor:
    cursor.execute('SET default_transaction_read_only = on')
    tables = set(connection.introspection.table_names(cursor))
    for model in apps.get_models():
        if model._meta.proxy or not model._meta.managed:
            continue
        table = model._meta.db_table
        if table not in tables:
            missing.append({'table': table, 'issue': 'missing table'})
            continue
        columns = {column.name for column in connection.introspection.get_table_description(cursor, table)}
        for field in model._meta.local_fields:
            if field.column and field.column not in columns:
                missing.append({'table': table, 'column': field.column})
result = {'schemaCompatible': not missing, 'missing': missing, 'readOnly': True, 'migrationsExecuted': False}
(root / 'test-results' / 'live-schema-preflight.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
sys.exit(0 if not missing else 2)
