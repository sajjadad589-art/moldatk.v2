# Reset and reconnect accounting (Android 1.3.33 / 37)

## Source of truth

The production router sends both owners and collectors to `App`; the old standalone
`CollectorApp` is not routed. Both use `createGeneratorSync` and the same generator-
scoped Supabase subscriber, invoice and tariff rows. POS and owner dashboards use
`authoritativeAccounting` with the same active month. Collector line permissions
still determine which subscribers may be displayed.

`generator_invoices` records the monthly charges, payments and remaining debt;
`generator_monthly_accounts` is the server-maintained monthly reporting ledger.
`refresh_generator_subscriber_balances` projects invoice balances onto subscriber
rows. `get_generator_cashbox` remains authoritative for the cashbox; its reset
boundary and cash-entry accounting are separate from subscriber debt.

## Failures addressed

- The synchronizer previously pushed durable pending local data before checking
  whether the owner had fully reset the server dataset. A stale device could replay
  pre-reset subscribers, invoices, audit/payment events and deletion tombstones.
- Full reset already removes collector accounts. A locally cached auth session did
  not prove the collector was still authorized, leaving old data displayed when
  cloud reads failed. Confirmed revocation now invalidates the financial cache and
  requests login. Network failure alone never discards work.
- Saving a subscriber used a second direct writer alongside event synchronization.
  It acknowledged the subscriber before invoice/audit persistence. Saving now uses
  the shared ordered sync flight.
- Subscriber delta reads did not apply the full-read no-tariff normalization or
  permanent-deletion tombstones. Both paths now use the same conversion.
- A null/cleared cashbox response could leave the old React balance alive, and an
  older response could replace a newer one. Both cases are guarded.

## Reset protocol

`generator_sync_state.epoch` is durable and is incremented in the same transaction
as the existing full operational purge. It is not a cashbox reset marker. Existing
full-reset semantics (including collector removal) are preserved; no destructive
UI is reintroduced.

Every sync checks live authorization and epoch before writing and checks epoch
again before applying a read. A changed epoch invalidates local financial state,
acknowledgements and tombstones. Pending work is retained under a generator-scoped
`moldatk_sync_recovery_*_SAFE` key for explicit recovery, never automatic replay.
Open owner edit/receipt surfaces are closed on reset.

Writes carry `x-moldatk-sync-epoch`. Database triggers share the reset advisory
lock and reject stale generations, including older clients after the first reset.
Old clients remain compatible at epoch zero. RLS and existing role/permission
checks remain in force. The new state table permits authorized reads only.

Realtime, online, manual sync, channel resubscription, BFCache restoration and
returning to a visible page all provide recovery paths. There is no polling loop.
An offline device cannot learn about a remote reset until it reconnects.

## Validation and rollout

`test:reset-sync` runs the real sync service with controlled transport failures and
an isolated PGlite database using the real purge SQL and new migration. Cases cover
divergent caches, full reset, offline/reconnect, identical owner/collector results,
preserving ordinary offline work, revoked access, reset during a read, stale writes,
successive resets, rollback, RLS and cross-generator isolation.

Existing cashbox tests independently cover retained history, late offline payments,
idempotent reset, cancellation and owner/collector cashbox parity. Release CI runs
both suites before Android signing, plus the existing accounting smoke tests.

Deploy the additive epoch migration before releasing the new client. Do not invoke
reset on production to test it. Existing production financial rows are untouched
by deployment. Android signing uses the existing repository secrets and the output
signature is verified before publishing. The update manifest is activated only
after release artifacts exist.
