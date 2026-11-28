# M03 first increment — read-only subscribers

M02 CI run 46132668301 passed analysis, unit/widget tests, Android debug APK and committed formatting. Live authentication and Android secure-storage runtime remain untested. Existing connected Supabase account contains no dedicated Moldatk staging project; do not repurpose other projects or incur costs without agreement.

Read-only schema preflight inspected generator_subscribers column definitions (not rows). Added a typed subscriber model, bounded keyset reader scoped to the verified operator generator, and a reusable Arabic list component with local filtering and load-more. The reader selects only basic list fields, not finance or notes. Foreign-tenant or malformed rows reject the entire page. Existing RLS remains the authority for collector line assignments and tenant isolation.

Not connected to staging session navigation yet: implement a serialized authorized request boundary, prevent stale results after logout or permission changes, and unmount list immediately on session lock. Search currently covers loaded records only; full server search, mutations, line management and all finance are later increments. Unit tests use synthetic rows; no network calls or database modifications have been made. Do not describe this as production-ready or complete M03.
