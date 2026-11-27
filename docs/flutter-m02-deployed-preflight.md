# M02 — deployed Supabase read-only preflight

Verified 2026-11-27 via catalog queries and Edge Function inventory. No production data read or changed.

- moldatk-auth is ACTIVE, deployed version 4; gateway verify_jwt=false to support pre-login. Existing source has rate limiting; verify deployed behavior and private action authorization in staging.
- All 47 public base tables have RLS enabled. Nine have no policies (including internal secrets and passkey tables); absence is default-deny for ordinary clients, not proof of correct grants.
- get_my_subscription_access_state(): jsonb, SECURITY DEFINER, empty search_path, executable by authenticated and not anon. It rejects null auth.uid(), derives generator_id from active profile, checks the generator and selects an active subscription with starts_at <= server now and ends_at > server now. It returns accessActive, serverNow, generator and subscription. No caller-supplied tenant id.
- Reviewed policies on profiles, generators, subscriptions, subscribers, collectors, invoices, payments and cashbox entries. Existing predicates reference current tenant, admin status, collector assignment and selected permissions.
- Invoices/payment insert and update policies shown in the catalog permit active collectors with subscriber access; verify operation-specific permissions and subscription enforcement in underlying helper functions/RPCs before enabling financial writes. Subscriber UPDATE likewise requires an active collector with line access; confirm that separate edit permissions are enforced if required. No policy changes made.
- RLS enablement and source review do not establish runtime isolation. Test owner A/B, collectors with different assigned lines, suspended/expired users and anonymous callers in staging, including direct REST calls and denied writes. Verify server-side enforcement independent of the Flutter interface.
- Use server time and accessActive for subscription gating; cache must not bypass expiry/revocation. Do not expose service-role keys or introduce new production endpoints until tests pass.

M01 compilation gate remains separate. M02 implementation is not yet validated.