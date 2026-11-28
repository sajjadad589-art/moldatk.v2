# M04 payment screen preview

Owner detail now reads active tariff before and after its invoice snapshot and reset epoch, rejects ambiguous or foreign tariff rows and offers full/partial payment allocation preview for a complete invoice page. No collection, offline write, printing or server transport is enabled. Reads are not a transaction; an actual write must revalidate the immutable ledger and authorization. The 50-row page cap still blocks payment preview for longer histories. Added tariff decoding test. Production unchanged.
