import 'package:supabase_flutter/supabase_flutter.dart';

import '../../subscribers/data/subscriber_draft_reader.dart';
import '../../subscribers/data/subscriber_reader.dart';
import '../../subscribers/domain/subscriber.dart';
import '../../subscribers/domain/subscriber_draft.dart';
import '../domain/operator_account.dart';
import '../domain/session_controller.dart';
import '../domain/subscription_access.dart';
import 'secure_session_store.dart';
import 'staging_config.dart';

/// Staging only. Only a refresh credential is persisted in secure storage.
class StagingSessionGateway implements SessionGateway {
  StagingSessionGateway(this._config)
    : _store = SecureSessionStore(_config, const PlatformSecretStorage());

  final StagingConfig _config;
  final SecureSessionStore _store;
  SupabaseClient? _client;

  @override
  Future<OperatorAccount> signIn({
    required String identifier,
    required String secret,
  }) async {
    await close();
    if (identifier.trim().isEmpty || secret.isEmpty) {
      throw const FormatException('Missing credentials');
    }
    final client = SupabaseClient(
      _config.url,
      _config.publishableKey,
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    _client = client;
    try {
      final reply = await client.functions.invoke(
        'moldatk-auth',
        body: {
          'action': 'password-login',
          'identifier': identifier.trim(),
          'secret': secret,
        },
      );
      final data = reply.data;
      if (data is! Map || data['ok'] != true) {
        throw const FormatException('Invalid sign-in response');
      }
      final account = OperatorAccount.fromJson(data['account']);
      final accessToken = _token(data['accessToken']);
      final refreshToken = _token(data['refreshToken']);
      final session = await client.auth.setSession(
        refreshToken,
        accessToken: accessToken,
      );
      if (!identical(_client, client) ||
          session.session?.user.id != account.userId) {
        throw const FormatException('Session identity mismatch');
      }
      await _persist(client, account.userId);
      return account;
    } catch (_) {
      await close();
      rethrow;
    }
  }

  @override
  Future<OperatorAccount?> restore() async {
    await release();
    final saved = await _store.load();
    if (saved == null) return null;
    final client = SupabaseClient(
      _config.url,
      _config.publishableKey,
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    _client = client;
    try {
      final restored = await client.auth.setSession(saved.refreshToken);
      if (restored.session?.user.id != saved.userId) {
        throw const FormatException('Stored identity mismatch');
      }
      final account = await _loadCurrentAccount(client, saved.userId);
      await _persist(client, account.userId);
      return account;
    } catch (_) {
      await close();
      rethrow;
    }
  }

  Future<OperatorAccount> _loadCurrentAccount(
    SupabaseClient client,
    String expectedUserId,
  ) async {
    final identity = await client.auth.getUser();
    if (identity.user?.id != expectedUserId) {
      throw const FormatException('Invalid authenticated identity');
    }
    final profile = await client
        .from('profiles')
        .select('id,role,generator_id,is_active')
        .eq('id', expectedUserId)
        .single();
    final role = profile['role'];
    final generatorId = profile['generator_id'];
    if (profile['is_active'] != true ||
        generatorId is! String ||
        generatorId.isEmpty ||
        (role != 'generator_admin' && role != 'employee')) {
      throw const FormatException('Account unavailable');
    }
    if (role == 'employee') {
      final collector = await client
          .from('generator_collectors')
          .select('id,generator_id,is_active')
          .eq('id', expectedUserId)
          .eq('generator_id', generatorId)
          .single();
      if (collector['is_active'] != true) {
        throw const FormatException('Collector unavailable');
      }
    }
    final generator = await client
        .from('generators')
        .select('id,name,status')
        .eq('id', generatorId)
        .single();
    if (generator['id'] != generatorId) {
      throw const FormatException('Generator mismatch');
    }
    return OperatorAccount.fromJson({
      'userId': expectedUserId,
      'generatorId': generatorId,
      'generatorName': generator['name'] ?? 'مولدتك',
      'role': role == 'employee' ? 'collector' : 'generator_admin',
    });
  }

  Future<void> _persist(SupabaseClient client, String userId) async {
    final session = client.auth.currentSession;
    if (!identical(client, _client) || session?.user.id != userId) {
      throw const FormatException('Invalid session');
    }
    await _store.save(
      SavedRefreshCredential(
        userId: userId,
        refreshToken: _token(session?.refreshToken),
      ),
    );
  }

  @override
  Future<SubscriptionDecision> checkAccess(OperatorAccount account) async {
    final client = _client;
    if (client == null || client.auth.currentUser?.id != account.userId) {
      return SubscriptionDecision.unavailable;
    }
    if (client.auth.currentSession?.isExpired == true) {
      final refreshed = await client.auth.refreshSession();
      if (refreshed.session?.user.id != account.userId) {
        return SubscriptionDecision.unavailable;
      }
    }
    final timer = Stopwatch()..start();
    final current = await _loadCurrentAccount(client, account.userId);
    if (current.generatorId != account.generatorId ||
        current.role != account.role) {
      return SubscriptionDecision.unavailable;
    }
    await _persist(client, account.userId);
    final result = await client.rpc('get_my_subscription_access_state');
    if (!identical(client, _client)) return SubscriptionDecision.unavailable;
    return SubscriptionDecision.evaluate(
      response: result,
      expectedGeneratorId: account.generatorId,
      elapsed: timer.elapsed,
    );
  }

  /// Call only through SessionController.readAuthorized.
  Future<SubscriberPage> readSubscribers(
    OperatorAccount account,
    String? afterId,
  ) async {
    final client = _client;
    if (client == null || client.auth.currentUser?.id != account.userId) {
      throw StateError('Session unavailable');
    }
    final page = await SubscriberReader.authenticated(
      client,
    ).readPage(account: account, afterId: afterId);
    if (!identical(client, _client) ||
        client.auth.currentUser?.id != account.userId) {
      throw StateError('Session changed');
    }
    return page;
  }

  /// Call only through SessionController.readAuthorized.
  Future<SubscriberDraftContext> readDraftOptions(
    OperatorAccount account,
  ) async {
    final client = _client;
    if (client == null || client.auth.currentUser?.id != account.userId) {
      throw StateError('Session unavailable');
    }
    final options = await SubscriberDraftReader(client).read(account);
    if (!identical(client, _client) ||
        client.auth.currentUser?.id != account.userId) {
      throw StateError('Session changed');
    }
    return options;
  }

  @override
  Future<void> close() async {
    final client = _client;
    _client = null;
    try {
      await _store.clear();
    } finally {
      if (client != null) {
        try {
          if (client.auth.currentSession != null) {
            await client.auth.signOut(scope: SignOutScope.local);
          }
        } finally {
          await client.dispose();
        }
      }
    }
  }

  @override
  Future<void> release() async {
    final client = _client;
    _client = null;
    if (client != null) await client.dispose();
  }

  static String _token(Object? value) {
    if (value is! String || value.isEmpty) {
      throw const FormatException('Missing session token');
    }
    return value;
  }
}
