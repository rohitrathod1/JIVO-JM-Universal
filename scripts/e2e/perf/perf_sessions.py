# Mint fresh sessions for existing perfNN users and list their load rooms (jm_e2e only). Writes PERF_OUT/perf-load.json.
import json, os
from django.conf import settings
from django.test import RequestFactory
from identity.models import User
from identity.service import start_session
from messenger.models import Conversation, ConversationMember
assert settings.DATABASES["default"]["NAME"] == "jm_e2e"
rf = RequestFactory(); out = {"users": {}, "rooms": []}
for u in User.objects.filter(email__regex=r"^perf[0-9]{2}@e2e\.invalid$").order_by("email"):
    _, raw = start_session(rf.get("/", HTTP_USER_AGENT="perf-load/1.0", REMOTE_ADDR="127.0.0.1"), u, "password")
    out["users"][u.email.split("@")[0]] = {"public_id": str(u.public_id), "session": raw}
for c in Conversation.objects.filter(title__startswith="Perf Load Room").order_by("title"):
    out["rooms"].append({"public_id": str(c.public_id), "members": sorted(m.user.email.split("@")[0] for m in ConversationMember.objects.filter(conversation=c, left_at__isnull=True).select_related("user"))})
json.dump(out, open(os.path.join(os.environ["PERF_OUT"], "perf-load.json"), "w"), indent=2)
print("sessions", len(out["users"]), "rooms", len(out["rooms"]), [len(r["members"]) for r in out["rooms"]])
