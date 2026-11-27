import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/auth/domain/session_controller.dart';
import 'package:moldatk_flutter/features/auth/domain/subscription_access.dart';

final fixture = OperatorAccount.fromJson({
  'userId': 'user-a',
  'generatorId': 'generator-a',
  'generatorName': 'Test',
  'role': 'generator_admin',
});

SubscriptionDecision decision({bool active = true}) {
  return SubscriptionDecision.evaluate(
    response: {
      'ok': true,
      'accessActive': active,
      'serverNow': '2026-11-27T12:00:00Z',
      'generator': {'id': 'generator-a', 'status': 'active'},
      'subscription': {
        'status': 'active',
        'startsAt': '2026-11-01T00:00:00Z',
        'endsAt': '2026-12-01T00:00:00Z',
      },
    },
    expectedGeneratorId: fixture.generatorId,
    elapsed: Duration.zero,
  );
}

class FakeGateway implements SessionGateway {
  SubscriptionDecision result = decision();
  Completer<OperatorAccount>? pending;
  bool fail = false;
  int closes = 0;

  @override
  Future<OperatorAccount> signIn({
    required String identifier,
    required String secret,
  }) async {
    if (fail) throw StateError('fixture failure');
    if (pending != null) return pending!.future;
    return fixture;
  }

  @override
  Future<SubscriptionDecision> checkAccess(OperatorAccount account) async {
    if (fail) throw StateError('fixture failure');
    return result;
  }

  @override
  Future<void> close() async {
    closes++;
  }
}

Future<void> login(SessionController controller) => controller.signIn(
  identifier: 'fixture',
  secret: 'fixture',
);

void main() {
  test('active session locks immediately after sign out', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    expect(controller.phase, SessionPhase.active);
    expect(controller.account?.generatorId, 'generator-a');
    await controller.signOut();
    expect(controller.phase, SessionPhase.signedOut);
    expect(controller.account, isNull);
    expect(gateway.closes, 1);
  });

  test('revocation after login denies local account access', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    gateway.result = decision(active: false);
    await controller.revalidate();
    expect(controller.phase, SessionPhase.denied);
    expect(controller.account, isNull);
  });

  test('network failure locks account during revalidation', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    gateway.fail = true;
    await controller.revalidate();
    expect(controller.phase, SessionPhase.unavailable);
    expect(controller.account, isNull);
  });

  test('late sign-in result cannot unlock a signed-out account', () async {
    final gateway = FakeGateway()..pending = Completer<OperatorAccount>();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    final operation = login(controller);
    await controller.signOut();
    gateway.pending!.complete(fixture);
    await operation;
    expect(controller.phase, SessionPhase.signedOut);
    expect(controller.account, isNull);
    expect(gateway.closes, 1);
  });
}
