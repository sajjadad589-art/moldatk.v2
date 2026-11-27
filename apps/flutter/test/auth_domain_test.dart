import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/auth/domain/subscription_access.dart';

Map<String, Object?> account(String role) => {
  'userId': 'user-a',
  'generatorId': 'generator-a',
  'generatorName': 'Generator A',
  'role': role,
};

Map<String, Object?> subscription({
  String generatorId = 'generator-a',
  String status = 'active',
  bool accessActive = true,
  String endsAt = '2026-11-27T12:00:30Z',
}) => {
  'ok': true,
  'serverNow': '2026-11-27T12:00:00Z',
  'accessActive': accessActive,
  'generator': {'id': generatorId, 'status': status},
  'subscription': {
    'status': 'active',
    'startsAt': '2026-11-01T00:00:00Z',
    'endsAt': endsAt,
  },
};

SubscriptionDecision evaluate(Object? response, [int elapsedSeconds = 0]) {
  return SubscriptionDecision.evaluate(
    response: response,
    expectedGeneratorId: 'generator-a',
    elapsed: Duration(seconds: elapsedSeconds),
  );
}

void main() {
  test('operator roles and tenant identifiers are mandatory', () {
    expect(
      OperatorAccount.fromJson(account('generator_admin')).role,
      OperatorRole.owner,
    );
    expect(
      OperatorAccount.fromJson(account('collector')).role,
      OperatorRole.collector,
    );
    expect(
      () => OperatorAccount.fromJson(account('super_admin')),
      throwsFormatException,
    );
    expect(
      () => OperatorAccount.fromJson(
        account('collector')..remove('generatorId'),
      ),
      throwsFormatException,
    );
  });

  test('server time controls remaining access', () {
    final result = evaluate(subscription(), 10);
    expect(result.access, SubscriptionAccess.active);
    expect(result.remaining, const Duration(seconds: 20));
  });

  test('expiry during the network round trip denies access', () {
    expect(evaluate(subscription(), 30).access, SubscriptionAccess.expired);
  });

  test('expired and suspended server decisions deny access', () {
    expect(
      evaluate(subscription(accessActive: false)).access,
      SubscriptionAccess.expired,
    );
    expect(
      evaluate(subscription(status: 'suspended', accessActive: false)).access,
      SubscriptionAccess.suspended,
    );
  });

  test('mismatched tenant, malformed and stale grants fail closed', () {
    expect(
      evaluate(subscription(generatorId: 'generator-b')).access,
      SubscriptionAccess.unavailable,
    );
    expect(
      evaluate(subscription(endsAt: 'invalid')).access,
      SubscriptionAccess.unavailable,
    );
    expect(evaluate(null).access, SubscriptionAccess.unavailable);
    expect(evaluate(subscription(), 60).access, SubscriptionAccess.unavailable);
    expect(evaluate(subscription(), -1).access, SubscriptionAccess.unavailable);
  });
}
