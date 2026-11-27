import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'staging_config.dart';

/// Storage abstraction allows tests without invoking a device keystore.
abstract interface class SecretStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class PlatformSecretStorage implements SecretStorage {
  const PlatformSecretStorage();

  static const _storage = FlutterSecureStorage();

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// A refresh credential is not an authenticated account or access grant.
class SavedRefreshCredential {
  const SavedRefreshCredential({
    required this.userId,
    required this.refreshToken,
  });

  final String userId;
  final String refreshToken;
}

/// One encrypted slot per explicitly validated staging project.
/// Does not store passwords, permissions, account data, or access tokens.
/// Callers must serialize operations and verify identity with the server.
class SecureSessionStore {
  SecureSessionStore(StagingConfig config, this._storage)
    : _project = Uri.parse(config.url).host;

  final String _project;
  final SecretStorage _storage;

  String get _key => 'moldatk.session.v1.$_project';

  Future<void> save(SavedRefreshCredential credential) async {
    if (!_valid(credential.userId) || !_valid(credential.refreshToken)) {
      throw const FormatException('Invalid refresh credential');
    }
    await _storage.write(
      _key,
      jsonEncode({
        'v': 1,
        'project': _project,
        'userId': credential.userId,
        'refreshToken': credential.refreshToken,
      }),
    );
  }

  Future<SavedRefreshCredential?> load() async {
    final raw = await _storage.read(_key);
    if (raw == null) return null;
    try {
      final value = jsonDecode(raw);
      if (value is! Map ||
          value['v'] != 1 ||
          value['project'] != _project ||
          !_valid(value['userId']) ||
          !_valid(value['refreshToken'])) {
        throw const FormatException('Invalid stored session');
      }
      return SavedRefreshCredential(
        userId: value['userId'] as String,
        refreshToken: value['refreshToken'] as String,
      );
    } on FormatException {
      await clear();
      return null;
    }
  }

  Future<void> clear() => _storage.delete(_key);

  static bool _valid(Object? value) =>
      value is String && value.isNotEmpty && value.length <= 4096;
}
