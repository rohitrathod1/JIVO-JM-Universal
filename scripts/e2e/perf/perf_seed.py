# Perf/load seed for the ISOLATED jm_e2e database only. Does NOT touch alice/bob/carol/dave/admin or accounts.json.
# Run (PowerShell, backend-env loaded):  manage.py shell -c "exec(open(r'<this file>', encoding='utf-8-sig').read())"
# Env PERF_OUT = folder for perf-accounts.json (session tokens; keep it in the scratchpad, not the repo).
import json, os, secrets, string, time, uuid
from django.conf import settings
from django.contrib.auth.models import Group
from django.test import RequestFactory
from identity.models import User
from identity.service import start_session
from messenger import services as ms
from messenger.models import Conversation, ConversationMember, Message

assert settings.DATABASES["default"]["NAME"] == "jm_e2e", "refusing: not the e2e database"
assert settings.JM_IDENTITY == "local"
OUT = os.environ["PERF_OUT"]
N = int(os.environ.get("PERF_USERS", "50"))
LONG = int(os.environ.get("PERF_LONG", "2000"))
CONVS = int(os.environ.get("PERF_CONVS", "500"))
NORMAL = Group.objects.filter(name__in=["Messenger Users", "Password Users"])
rf = RequestFactory()

def pw():
    a = string.ascii_letters + string.digits
    return "Perf!" + "".join(secrets.choice(a) for _ in range(20)) + "#9"

def user(name):
    email = f"{name}@e2e.invalid"
    p = pw()
    u = User.objects.filter(email=email).first()
    if u is None:
        u = User.objects.create_user(email=email, password=p, full_name=f"{name.title()} Perf")
    else:
        u.set_password(p); u.save()
    u.groups.set(NORMAL)
    req = rf.get("/", HTTP_USER_AGENT="perf-load/1.0", REMOTE_ADDR="127.0.0.1")
    _, raw = start_session(req, u, "password")
    return u, {"email": email, "password": p, "public_id": str(u.public_id), "session": raw}

out = {"users": {}, "rooms": [], "heavy": {}}
users = []
for i in range(N):
    u, rec = user(f"perf{i:02d}")
    users.append(u); out["users"][f"perf{i:02d}"] = rec

# 10 rooms of 5 users each for the load test
for r in range(N // 5):
    title = f"Perf Load Room {r:02d}"
    members = users[r * 5:(r + 1) * 5]
    conv = Conversation.objects.filter(kind=Conversation.Kind.GROUP, title=title, created_by=members[0]).first() \
        or ms.create_group(members[0], title=title, member_ids=[m.public_id for m in members[1:]])
    out["rooms"].append({"public_id": str(conv.public_id), "members": [f"perf{(r*5+k):02d}" for k in range(5)]})

heavy, hrec = user("perfheavy")
peer, prec = user("perfpeer")
out["heavy"] = {"user": hrec, "peer": prec}
t0 = time.time()
long_conv, _ = ms.open_direct(heavy, peer.public_id)
have = Message.objects.filter(conversation=long_conv, kind="text").count()
hm = ConversationMember.objects.get(conversation=long_conv, user=heavy)
pm = ConversationMember.objects.get(conversation=long_conv, user=peer)
for i in range(have, LONG):
    s, m = (heavy, hm) if i % 2 == 0 else (peer, pm)
    body = f"Perf long-chat message {i+1:04d}. " + ("Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * (1 + i % 4))
    ms.send(s, long_conv, m, client_id=uuid.uuid4(), body=body)
out["heavy"]["long_chat"] = {"public_id": str(long_conv.public_id),
                             "messages": Message.objects.filter(conversation=long_conv, kind="text").count(),
                             "seed_seconds": round(time.time() - t0, 1)}
t1 = time.time()
existing = Conversation.objects.filter(kind=Conversation.Kind.GROUP, created_by=heavy, title__startswith="Perf Conv ").count()
for k in range(existing, CONVS):
    c = ms.create_group(heavy, title=f"Perf Conv {k:03d}", member_ids=[peer.public_id])
    if k % 5 == 0:
        ms.send(heavy, c, ConversationMember.objects.get(conversation=c, user=heavy), client_id=uuid.uuid4(), body=f"hello {k}")
out["heavy"]["conversations"] = ConversationMember.objects.filter(user=heavy).count()
out["heavy"]["conv_seed_seconds"] = round(time.time() - t1, 1)
json.dump(out, open(os.path.join(OUT, "perf-accounts.json"), "w"), indent=2)
print("perf seeded: users", len(out["users"]), "rooms", len(out["rooms"]), "long", out["heavy"]["long_chat"]["messages"],
      "heavy convs", out["heavy"]["conversations"])
