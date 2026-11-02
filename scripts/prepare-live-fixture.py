"""Create synthetic accounts only in the Django test database for cross-client verification."""
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
backend = root.parent / 'JIVO-JM-Backend'
sys.path.insert(0, str(backend))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
if not os.environ.get('DB_NAME', '').startswith('test_'):
    raise RuntimeError('This fixture requires an explicit test_ database; never run against application data.')

import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from core.testing import PASSWORD, make_user, post, signed_in
from identity.models import User

assert settings.DATABASES['default']['NAME'].startswith('test_')
assert settings.JM_DEPLOYMENT == 'development'
assert settings.JM_MESSENGER_KEY_SERVICE == 'local'
settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, 'testserver']
call_command('migrate', verbosity=0, interactive=False)
people = []
for email, name in [('universal-smoke@jivo.test', 'Universal Alice'), ('frontend-smoke@jivo.test', 'Frontend Bob')]:
    user = User.objects.filter(email=email).first()
    if user is None:
        user = make_user(email, full_name=name)
    people.append(user)
client = signed_in(people[0], verified=False, step_up=False)
response = post(client, '/api/jm/conversations/direct/', {'user_id': str(people[1].public_id)})
assert response.status_code in (200, 201), response.content
result = {'conversation': response.json()['id'], 'users': [{'id': str(p.public_id), 'email': p.email, 'password': PASSWORD} for p in people]}
destination = root / 'test-results' / 'live-fixture.json'
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(result))
print('Synthetic fixture ready in test database; no application accounts modified.')
