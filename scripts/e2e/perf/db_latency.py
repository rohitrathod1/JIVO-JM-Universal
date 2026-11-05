# Round-trip latency of the jm_e2e PostgreSQL (127.0.0.1:5433) plus a server-side profile of one send and one /me.
import time, uuid, statistics as st
from django.db import connection as c, reset_queries
from django.conf import settings
from django.test.utils import CaptureQueriesContext
assert c.settings_dict["NAME"] == "jm_e2e"
cur = c.cursor()
t = []
for _ in range(200):
    s = time.perf_counter(); cur.execute("select 1"); cur.fetchone(); t.append((time.perf_counter() - s) * 1000)
t.sort(); print("select1 ms p50 %.2f p95 %.2f max %.2f" % (t[100], t[190], t[-1]))
cur.execute("select ssl from pg_stat_ssl where pid = pg_backend_pid()"); print("ssl", cur.fetchone())
cur.execute("select count(*), sum(case when state='active' then 1 else 0 end) from pg_stat_activity"); print("server-wide connections (all dbs), active", cur.fetchone())
from identity.models import User
from messenger import services as ms
from messenger.models import Conversation, ConversationMember, Message
u = User.objects.get(email="perf49@e2e.invalid")
conv = Conversation.objects.filter(title="Perf Load Room 09").first()
m = ConversationMember.objects.get(conversation=conv, user=u)
for label in ("send #1", "send #2", "send #3"):
    with CaptureQueriesContext(c) as q:
        s = time.perf_counter(); ms.send(u, conv, m, client_id=uuid.uuid4(), body="db-latency probe"); d = (time.perf_counter() - s) * 1000
    print(label, "%.0f ms" % d, "queries", len(q), "sql ms %.0f" % sum(float(x["time"]) * 1000 for x in q.captured_queries))
from collections import Counter
tables = Counter()
for x in q.captured_queries:
    sql = x["sql"]; i = sql.find("FROM \""); tables[(sql.split()[0], sql[i+6:sql.find('"', i+6)] if i >= 0 else "")] += 1
print("top statements in last send:", tables.most_common(12))
