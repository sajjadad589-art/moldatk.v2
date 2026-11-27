# Moldatk Flutter — M01 foundation

This is the first isolated engineering increment, not a production-ready application. The existing React/Vite website and Capacitor Android sources are untouched. There are no production credentials, database writes, fake accounts, or store submissions in M01.

## Toolchain and local verification

Use Flutter 3.38.5 as the initial reproducible SDK baseline (review supported SDKs and target API before release), Python 3, Java 17 and Android SDK. From this directory:

```sh
flutter doctor -v
python tool/bootstrap_android.py
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug --dart-define=APP_ENV=development
```

Run bootstrap only once; it refuses to overwrite existing platform files. The generated Android project has production application ID `com.mwaldatk.app` and a debug suffix `.dev`, so the debug app does not replace the existing installed app. The generated Android files and pubspec.lock must be reviewed and committed after the first verified build. No release signing is configured here. Production builds must preserve the existing app signing identity and exceed the actual Play Console version code.

## Design and next gates

- M01: SDK, RTL shell, environment configuration and tests. Do not call the current screen a login screen or a completed feature.
- M02: inventory and verify existing moldatk-auth and authorization contracts. Staging-only first, no client service-role secrets, no production mutations. Enforce tenant isolation and subscription expiry on the server.
- M03/M04: port all subscriber, payment and accounting behavior; preserve regression fixtures. Money in integer units, authoritative backend, idempotency keys and audit.
- M05: account-scoped Drift/SQLite persistence, encrypted sensitive storage, outbox and conflict handling; test crash recovery and retries. Dependencies and schema are added after contracts are verified.
- M06: port existing Sunmi SDK bridge using platform channels and test real hardware.
- M07+: notifications, reports, release management, platform support and quality gates. No replacement of Capacitor Android or release to Play before acceptance tests.

CI is intended to verify the shell and debug build; its result must be checked, not assumed. No data deletion is necessary.
