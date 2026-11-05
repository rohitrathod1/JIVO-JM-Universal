# Print jm_e2e connections from pg_stat_activity (state, idle time, query head). jm_e2e only.
from django.db import connection as c
assert c.settings_dict["NAME"] == "jm_e2e"
cur = c.cursor()
cur.execute("select pid, client_port, state, round(extract(epoch from now()-state_change)::numeric,1), round(extract(epoch from now()-xact_start)::numeric,1), left(regexp_replace(query, '\s+', ' ', 'g'), 110) from pg_stat_activity where datname='jm_e2e' and pid <> pg_backend_pid() order by state, 4 desc")
rows = cur.fetchall()
print("connections", len(rows))
for r in rows: print(r)
