# cProfile one messenger send (jm_e2e only) and print the top cumulative/own-time functions.
import cProfile, pstats, io, uuid
from django.db import connection as c
assert c.settings_dict["NAME"] == "jm_e2e"
from identity.models import User
from messenger import services as ms
from messenger.models import Conversation, ConversationMember
u = User.objects.get(email="perf48@e2e.invalid")
conv = Conversation.objects.filter(title="Perf Load Room 09").first()
m = ConversationMember.objects.get(conversation=conv, user=u)
ms.send(u, conv, m, client_id=uuid.uuid4(), body="warm")
pr = cProfile.Profile(); pr.enable()
ms.send(u, conv, m, client_id=uuid.uuid4(), body="profile probe")
pr.disable()
for key in ("cumulative", "tottime"):
    s = io.StringIO(); pstats.Stats(pr, stream=s).sort_stats(key).print_stats(22); print(s.getvalue()[:6000])
