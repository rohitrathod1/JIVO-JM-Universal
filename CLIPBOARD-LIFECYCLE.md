# Clipboard lifecycle and bounded source parity

## Implemented

Web secrets can be copied only by an explicit button while the revealed value is present. Reveal expires at the earlier server deadline or 30 seconds and clears on blur/unmount. The copy controller rejects inactive/repeated actions, reports the existing copy-event contract after a successful current write, distinguishes write denial from unconfirmed auditing, and suppresses late feedback/audits after lifecycle invalidation. Values are not added to storage, logs or URLs. A browser write already submitted cannot be cancelled; if it completes after the view closes, the OS clipboard can still contain that explicitly requested value.

## Unavailable by preservation requirement

No automatic clipboard clearing or background clipboard read is installed. The current reference unconditionally writes an empty string after a timer/focus; Universal does not reproduce that behavior because it can erase unrelated data. Browser readText and writeText are separate asynchronous operations, without atomic ownership-conditional clearing. Even comparing text before clearing has a cross-application race and cannot distinguish another app copying identical text. See https://www.w3.org/TR/clipboard-apis/#clipboard-interface .

Under the requirement never to erase unrelated clipboard content, safe automatic OS clearing remains blocked on a validated platform primitive. This is an API limitation, not a permission denial or pending approval. Native copying is explicitly unavailable rather than adding an unvalidated adapter. No new dependency was added. Copied secrets may remain in OS clipboard history or sync; automatic deletion is not promised.

## Tested with synthetic data

Unit cases: successful write/report, no timed or background empty write, preserve replacement content, inactive and repeated actions, delayed write/audit completion after invalidation, write denial and audit failure. Browser tests replace navigator.clipboard entirely, copy MOCK_REVEAL_ONLY, replace it with unrelated synthetic text and confirm that reveal expiry leaves the replacement untouched. No actual clipboard data or sensitive value was read or written.

## Manual review steps

Run node verify-current.cjs with synthetic mocks first. In a separately authorized non-production manual browser session, use only disposable synthetic values to check secure-context availability, permission denial, copy success, navigation/blur during a pending request and browser-specific activation rules. Replace the clipboard yourself after use; do not assume clearing or clipboard-history removal. Native behavior requires an explicitly reviewed adapter and device validation before offering this feature.
