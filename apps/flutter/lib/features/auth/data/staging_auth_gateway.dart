import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/operator_account.dart';
import '../domain/subscription_access.dart';
import 'staging_config.dart';

class OperatorAccess {
  const OperatorAccess(this.account, this.subscription);

  final OperatorAccount account;
  final SubscriptionDecision subscription;
}

/// Initial network adapter. No disk persistence or financial writes.
/// Each sign-in check uses an isolated in-memory client and signs out locally
/// before returning. The full session controller is a separate integration.
class StagingAuthGateway {
  const StagingAuthGateway(this.config);

  final StagingConfig config;

  Future<OperatorAccess> verifySignIn({
    required String identifier,
    required String secret,
  }) async {
    if (identifier.trim().isEmpty || secret.isEmpty) {
      throw const FormatException('Missing credentials');
    }
    final client = SupabaseClient(
      config.url,
      config.publishableKey,
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
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
      final accessToken = _requiredToken(data['accessToken']);
      final refreshToken = _requiredToken(data['refreshToken']);
      final session = await client.auth.setSession(
        refreshToken,
        accessToken: accessToken,
      );
      if (session.session?.user.id != account.userId) {
        throw const FormatException('Account identity mismatch');
      }

      final timer = Stopwatch()..start();
      final subscription = await client.rpc('get_my_subscription_access_state');
      timer.stop();
      final decision = SubscriptionDecision.evaluate(
        response: subscription,
        expectedGeneratorId: account.generatorId,
        elapsed: timer.elapsed,
      );
      return OperatorAccess(account, decision);
    } finally {
      try {
        if (client.auth.currentSession != null) {
          await client.auth.signOut(scope: SignOutScope.local);
        }
      } finally {
        await client.dispose();
      }
    }
  }

  static String _requiredToken(Object? value) {
    if (value is! String || value.isEmpty) {
      throw const FormatException('Invalid token response');
    }
    return value;
  }
}
