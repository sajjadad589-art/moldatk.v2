# v21 - Settings actions fix

## Fixes

- Activated the **الكابينات / البوردات** card to open the full technical editor instead of the old limited modal.
- Fixed adding new cabinet/board/line records by creating complete `LineDistribution` objects with phase, zone, capacity, load and breaker fields.
- Activated the **بيانات المولد وقدرة المحولة (KVA)** card.
- The generator specs editor now controls generator name, engine model, KVA capacity, amp capacity, fuel tank, burn rate, owner phone and location.
- Keeps v20 protection for unsaved edits so background refresh does not reset forms while editing.

## Build

The Vercel build now runs:

```bash
node scripts/apply-settings-folder-actions-fix.mjs && node scripts/apply-unsaved-edit-fix.mjs && vite build
```
