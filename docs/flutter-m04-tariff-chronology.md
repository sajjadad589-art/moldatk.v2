# Payment chronology guard

Require explicit reset epoch header even at zero. Reject payable debt without an existing tariff. For months participating in the subscriber ledger, reject disagreement between calendar order and tariff creation order, including equal creation timestamps. Added two synthetic regression assertions for absent header and chronology. This deliberately blocks ambiguous legacy records rather than silently allocating them. Still private review only; no production changes.
