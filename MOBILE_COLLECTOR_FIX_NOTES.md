# v14 Mobile + Collector Login Fix

- Fixed mobile bottom navigation so it appears in forced mobile view and on phones.
- Added logout button to the mobile header.
- Fixed collector login after account isolation by scanning scoped collector accounts and attaching generatorId to collector sessions.
- Collector now reads the same scoped subscribers, pricing, lines, generator name, and payment updates as the owner account.
- Owner-created collectors remain isolated under their generator account and do not appear in other accounts.
