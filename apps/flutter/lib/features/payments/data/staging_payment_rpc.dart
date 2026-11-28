import 'dart:convert';
import 'dart:io';

import '../../auth/data/staging_config.dart';
import '../../auth/domain/operator_account.dart';
import '../domain/payment_command.dart';

enum PaymentRpcOperation { collect, status }

/// Explicitly gated HTTPS transport for future hosted staging only.
/// The fixture RPCs are not installed on a hosted project yet.
class StagingPaymentRpc {
  const StagingPaymentRpc(this._config);

  final StagingConfig _config;
  static const enabled = bool.fromEnvironment('ENABLE_STAGING_PAYMENT_RPC');
  static const _timeout = Duration(seconds: 20);

  static String functionName(PaymentRpcOperation operation) =>
      switch (operation) {
        PaymentRpcOperation.collect => 'flutter_stage_collect_payment_v1',
        PaymentRpcOperation.status => 'flutter_stage_payment_status_v1',
      };

  Future<Object?> call({
    required PaymentRpcOperation operation,
    required OperatorAccount account,
    required PaymentCommand command,
    required String accessToken,
  }) async {
    if (!enabled) throw StateError('Staging payment RPC disabled');
    command.assertAccount(account);
    if (accessToken.isEmpty) throw StateError('Missing access token');
    final uri = Uri.parse(
      '${_config.url}/rest/v1/rpc/${functionName(operation)}',
    );
    final client = HttpClient()..connectionTimeout = _timeout;
    try {
      final request = await client.postUrl(uri).timeout(_timeout);
      request.followRedirects = false;
      request.headers.contentType = ContentType.json;
      request.headers.set('apikey', _config.publishableKey);
      request.headers.set('Authorization', 'Bearer $accessToken');
      for (final header in command.headers.entries) {
        request.headers.set(header.key, header.value);
      }
      request.write(jsonEncode(command.arguments));
      final response = await request.close().timeout(_timeout);
      if (response.statusCode != HttpStatus.ok) {
        throw StateError('Payment RPC rejected or unavailable');
      }
      final bytes = <int>[];
      await for (final chunk in response.timeout(_timeout)) {
        bytes.addAll(chunk);
        if (bytes.length > 512000) {
          throw const FormatException('Payment response too large');
        }
      }
      return jsonDecode(utf8.decode(bytes));
    } finally {
      client.close(force: true);
    }
  }
}
