# Payment receipt compatibility

The SQL candidate now stores the legacy SubscriberReceiptSnapshot field names used by the existing QR portal separately from the versioned RPC receipt. The regression checks the exact allocation and cash amount. Actual portal and printer integration and monthly-account parity still require staging verification. No active endpoint or production change.
