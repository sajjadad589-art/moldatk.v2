import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/core/config/app_config.dart';
import 'package:moldatk_flutter/features/auth/data/secure_session_store.dart';
import 'package:moldatk_flutter/features/auth/data/staging_config.dart';

class MemoryStorage implements SecretStorage {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

StagingConfig config(String ref) => StagingConfig.validate(
  environment: AppEnvironment.staging,
  projectRef: ref,
  url: 'https://$ref.supabase.co',
  publishableKey: 'sb_publishable_fixture',
);

void main() {
  const credential = SavedRefreshCredential(
    userId: 'test-user',
    refreshToken: 'test-refresh',
  );

  test('stores only refresh identity and clears the slot on logout', () async {
    final storage = MemoryStorage();
    final store = SecureSessionStore(config('abcdefghijklmnopqrst'), storage);
    expect(await store.load(), isNull);
    await store.save(credential);
    expect((await store.load())?.userId, 'test-user');
    expect((await store.load())?.refreshToken, 'test-refresh');
    expect(storage.values.values.single, isNot(contains('accessToken')));
    await store.clear();
    expect(await store.load(), isNull);
  });

  test('staging project slots cannot restore each other', () async {
    final storage = MemoryStorage();
    final first = SecureSessionStore(config('abcdefghijklmnopqrst'), storage);
    final second = SecureSessionStore(config('bcdefghijklmnopqrstu'), storage);
    await first.save(credential);
    expect(await second.load(), isNull);
    expect((await first.load())?.userId, credential.userId);
    await second.clear();
    expect(await first.load(), isNotNull);
  });

  test('corrupted or foreign credentials are discarded', () async {
    final storage = MemoryStorage();
    final store = SecureSessionStore(config('abcdefghijklmnopqrst'), storage);
    await store.save(credential);
    final key = storage.values.keys.single;
    storage.values[key] = '{invalid';
    expect(await store.load(), isNull);
    expect(storage.values, isEmpty);
    await store.save(credential);
    storage.values[key] = storage.values[key]!.replaceAll(
      'abcdefghijklmnopqrst',
      'bcdefghijklmnopqrstu',
    );
    expect(await store.load(), isNull);
    expect(storage.values, isEmpty);
  });
}
