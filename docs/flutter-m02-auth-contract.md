# Flutter M02 — authentication and subscription contract inventory

Status: source review only; do not connect the Flutter app to production or implement M02 until the M01 build gate passes. The original Android and web apps remain untouched.

## Verified against existing source
- `src/lib/authAccounts.ts`: calls the `moldatk-auth` Edge Function. Optional discover request: {action: "discover", identifier}. Password request: {action: "password-login", identifier, secret}. Success: {ok: true, accessToken, refreshToken, account}. A discovery role hint is not authorization.
- `supabase/functions/moldatk-auth/index.ts`: handles email and phone-based credentials, checks active profile and generator, maps employee to collector and returns server-derived account metadata including assigned lines and collector permissions. It applies rate limits and returns generic invalid credentials for failed grants. Do not reproduce password transformations in Flutter. Do not store the user's password. No service-role key may be packaged.
- Account roles: generator_admin, collector, super_admin, super_admin_manager. Flutter operator app initially admits only generator_admin and collector; the existing web Super Admin remains separate. Server policies must enforce all permissions; client role controls alone do not provide security.
- Account response: userId, role, generatorId, generatorName, ownerName, location, collectorId, collectorName, collectorPermissions, assignedLineId, assignedLineName, assignedLineIds, assignedAllLines. Validate types, identity and role before access.
- `src/App.tsx`: calls authenticated RPC `get_my_subscription_access_state`. Response inspected in client: ok, accessActive, serverNow, generator (id, name, ownerName, phone, status, suspensionReason), subscription (startsAt, endsAt, status). No tenant identifier should be trusted from user input. Server accessActive is authoritative.
- `src/components/SubscriptionStatusUI.tsx`: warning days are currently computed from endsAt minus device Date.now(). Flutter should instead use a verified server timestamp plus monotonic elapsed time while fresh; refresh on resume/reconnection and reject malformed or stale decisions. Do not create a fake expiry or grant access when the server rejects it. A prior discrepancy in a warning is not diagnosed by this source review alone.
- Existing browser passkeys use additional Edge Function actions and WebAuthn. Native passkeys are a separate compatibility/security gate, not a prerequisite for an initial staging password-login test.

## Required implementation and acceptance gates
1. Verify deployed staging contracts and RLS against two synthetic tenants and owner/collector identities. No real subscriber data, production credentials or live login probes.
2. Implement typed auth and subscription models; Supabase SDK session restoration using supported refresh-token APIs, encrypted storage, serialized refresh and logout that clears account-scoped sensitive state. Never log tokens or credentials.
3. Password-login, expired/suspended/unavailable states and retry; prevent local time changes from extending access. Unknown server status fails closed. No offline financial authorization until an explicit, bounded offline access policy and idempotent sync are tested in M05.
4. Test invalid credentials, malformed responses, refresh failures, expired/revoked sessions, role restrictions, collector line permissions, account switch, suspended/expired subscriptions, changed device clock, server timeout, reconnection and cross-tenant access denial.
5. Validate actual Android build and staging integration before declaring M02 complete. No production data or existing release settings changed.

Source review does not prove deployed functions, RLS or authentication work at runtime. M01 CI results are tracked separately.
