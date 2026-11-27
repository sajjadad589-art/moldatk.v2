# M02 — session management increment

Added an in-memory session controller and staging-only Supabase gateway. The controller grants local account access only after a fresh server subscription decision, locks immediately on sign-out, rejects late login results, and denies access after a failed check. Unit tests exercise these behaviors with a fake transport.

Not yet wired into the staging UI. No persistent session, no production connection, and no offline authorization. A UI lifecycle integration must schedule refresh/lock on background/resume and expiration, implement controlled timeouts and ensure old in-flight requests are disposed before another account starts. Tests must be confirmed by CI. Real staging RLS tests and secure platform-backed storage remain open.
