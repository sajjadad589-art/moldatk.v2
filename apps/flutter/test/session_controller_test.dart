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
  Completer<SubscriptionDecision>? pendingCheck;
  bool fail = false;
  int closes = 0;
  OperatorAccount? savedAccount;

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
    if (pendingCheck != null) return pendingCheck!.future;
    return result;
  }

  @override
  Future<OperatorAccount?> restore() async => savedAccount;

  @override
  Future<void> release() async {}

  @override
  Future<void> close() async {
    savedAccount = null;
    closes++;
  }
}

Future<void> login(SessionController controller) =>
    controller.signIn(identifier: 'fixture', secret: 'fixture');

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

  test('sign out during revalidation closes the old transport', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    gateway.pendingCheck = Completer<SubscriptionDecision>();
    final operation = controller.revalidate();
    await controller.signOut();
    expect(controller.account, isNull);
    gateway.pendingCheck!.complete(decision());
    await operation;
    expect(controller.phase, SessionPhase.signedOut);
    expect(controller.account, isNull);
    expect(gateway.closes, 1);
  });

  test('restored account is granted only after server access check', () async {
    final gateway = FakeGateway()..savedAccount = fixture;
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await controller.restore();
    expect(controller.phase, SessionPhase.active);
    expect(controller.account?.userId, fixture.userId);
  });

  test('restored account cannot bypass expired subscription', () async {
    final gateway = FakeGateway()
      ..savedAccount = fixture
      ..result = decision(active: false);
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await controller.restore();
    expect(controller.phase, SessionPhase.denied);
    expect(controller.account, isNull);
  });

  test('authorized reads require a verified active session', () async {
    final controller = SessionController(FakeGateway());
    addTearDown(controller.dispose);
    var called = false;
    await expectLater(
      controller.readAuthorized((_) async {
        called = true;
        return 1;
      }),
      throwsStateError,
    );
    expect(called, isFalse);
    await login(controller);
    expect(await controller.readAuthorized((_) async => 42), 42);
  });

  test('revocation before a read prevents the data request', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    gateway.result = decision(active: false);
    var called = false;
    await expectLater(
      controller.readAuthorized((_) async {
        called = true;
        return 1;
      }),
      throwsStateError,
    );
    expect(called, isFalse);
    expect(controller.phase, SessionPhase.denied);
  });

  test('revocation during a read discards the result', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    await expectLater(
      controller.readAuthorized((_) async {
        gateway.result = decision(active: false);
        return 42;
      }),
      throwsStateError,
    );
    expect(controller.phase, SessionPhase.denied);
  });

  test('logout during a read discards data and serializes access', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    final started = Completer<void>();
    final pending = Completer<int>();
    final operation = controller.readAuthorized((_) {
      started.complete();
      return pending.future;
    });
    final rejected = expectLater(operation, throwsStateError);
    await started.future;
    await expectLater(
      controller.readAuthorized((_) async => 2),
      throwsStateError,
    );
    await controller.signOut();
    expect(controller.account, isNull);
    pending.complete(42);
    await rejected;
    expect(controller.phase, SessionPhase.signedOut);
    expect(gateway.closes, 1);
  });

  test('write is never dispatched without active authorization', () async {
    final gateway = FakeGateway();
    final controller = SessionController(gateway);
    addTearDown(controller.dispose);
    await login(controller);
    gateway.result = decision(active: false);
    var called = false;
    await expectLater(
      controller.writeAuthorized((_) async {
        called = true;
        return 1;
      }),
      throwsStateError,
    );
    expect(called, isFalse);
  });

  test('verified write returns the result exactly once', () async {
    final controller = SessionController(FakeGateway());
    addTearDown(controller.dispose);
    await login(controller);
    var calls = 0;
    final result = await controller.writeAuthorized((account) async {
      expect(account.userId, fixture.userId);
      calls++;
      return 42;
    });
    expect(result, 42);
    expect(calls, 1);
  });

  test('transport failure after dispatch has unknown outcome', () async {
    final controller = SessionController(FakeGateway());
    addTearDown(controller.dispose);
    await login(controller);
    var calls = 0;
    await expectLater(
      controller.writeAuthorized<int>((_) async {
        calls++;
        throw StateError('Lost response');
      }),
      throwsA(isA<WriteOutcomeUnknown>()),
    );
    expect(calls, 1);
    expect(controller.account, isNull);
  });

  test('logout during dispatch is not reported as a failed write', () async {
    final controller = SessionController(FakeGateway());
    addTearDown(controller.dispose);
    await login(controller);
    final started = Completer<void>();
    final pending = Completer<int>();
    final operation = controller.writeAuthorized((_) {
      started.complete();
      return pending.future;
    });
    final rejected = expectLater(operation, throwsA(isA<WriteOutcomeUnknown>()));
    await started.future;
    await controller.signOut();
    pending.complete(42);
    await rejected;
    expect(controller.account, isNull);
  });

  test('missing stored credentials stays signed out', () async {
    final controller = SessionController(FakeGateway());
    addTearDown(controller.dispose);
    await controller.restore();
    expect(controller.phase, SessionPhase.signedOut);
    expect(controller.account, isNull);
  });
}
