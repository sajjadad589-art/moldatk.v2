# M03 atomic subscriber-create contract (not deployed)

Client command: immutable UUID v4 request ID, trimmed subscriber fields, exact tier and line IDs, physical and discount amperes, debt mode, historical month, expected active month and expected debt in integer IQD. The last two are confirmation guards, not authoritative billing. No tenant ID, invoice rows, payment status or cashbox mutations supplied by client. Blank code requests server allocation. Receipt must echo request ID, generator ID, subscriber ID, amount due and replay boolean.

Server implementation acceptance requirements:
- Authenticate caller; derive generator from verified profile and subscription; enforce current permissions and line assignment inside the write transaction. Initially enable owner only; collector invoice triggers currently require separate payment/cancellation permissions, so collector onboarding needs explicit reviewed policy rather than bypassing triggers.
- Keep an idempotency record unique to generator, actor and request ID, store canonical payload digest and result; reject reuse with differing payload. Recheck current access before returning any replay; prevent replay from resurrecting deleted/reset records. Coordinate with existing generator reset epoch and legacy writers.
- Lock/read authoritative active and historical tariff, verify exact tier ID, calculate charges on server and reject stale confirmation before any write. Allocate unique subscriber code under concurrency.
- In one DB transaction create subscriber, complete invoice snapshots with legacy markers, audit record, recount line, and record idempotency result. No cash collection or cashbox credit on onboarding. Roll back all effects on failure.
- Test simultaneous identical calls, conflicting request body, reset/deletion, role revocation, cross-tenant lines, stale pricing, missing pricing, rollback after invoice failure and reconciliation with the existing app.

This commit implements the Dart command and strict receipt parser only; no endpoint, database migration, UI save action or persistent retry queue is active. Dedicated staging and actual schema/trigger validation remain blockers. Do not enable saving until transaction and integration tests pass.
