import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/operator_account.dart';
import '../domain/session_controller.dart';
import '../domain/subscription_access.dart';
import 'staging_config.dart';

/// Staging only. The SDK session exists in memory and is never written to disk.
class StagingSessionGateway implements SessionGateway {
  StagingSessionGateway(this._config);

  final StagingConfig _config;
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
      return account;
    } catch (_) {
      await close();
      rethrow;
    }
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
    final result = await client.rpc('get_my_subscription_access_state');
    if (!identical(client, _client)) return SubscriptionDecision.unavailable;
    return SubscriptionDecision.evaluate(
      response: result,
      expectedGeneratorId: account.generatorId,
      elapsed: timer.elapsed,
    );
  }

  @override
  Future<void> close() async {
    final client = _client;
    _client = null;
    if (client == null) return;
    try {
      if (client.auth.currentSession != null) {
        await client.auth.signOut(scope: SignOutScope.local);
      }
    } finally {
      await client.dispose();
    }
  }

  static String _token(Object? value) {
    if (value is! String || value.isEmpty) {
      throw const FormatException('Missing session token');
    }
    return value;
  }
}
