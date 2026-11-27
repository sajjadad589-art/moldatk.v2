# M02 domain implementation

The operator account parser admits owner and collector roles only. SubscriptionDecision checks the authenticated tenant, server access decision, server timestamps and request age; it never uses the device wall clock. It denies malformed, stale and mismatched decisions. Tests cover role restrictions, server-time expiry, suspension, cross-tenant mismatch and stale decisions.

This is a client-side defensive gate, not authorization: Supabase RLS and server permissions remain mandatory. The models are not wired into the UI or real API yet. A fresh server decision must be obtained after restart, resume and before sensitive operations as appropriate. Never persist a monotonic elapsed value across restarts. No offline authorization, no production data changes. Integration, secure session storage, real staging authentication and financial permissions remain open.

M01 Android build is separately tracked. Do not publish this development branch.