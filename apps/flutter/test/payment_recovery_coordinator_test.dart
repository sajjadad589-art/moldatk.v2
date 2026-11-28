import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/auth/domain/session_controller.dart';
import 'package:moldatk_flutter/features/auth/domain/subscription_access.dart';
import 'package:moldatk_flutter/features/payments/data/pending_payment_store.dart';
import 'package:moldatk_flutter/features/payments/domain/payment_command.dart';
import 'package:moldatk_flutter/features/payments/domain/payment_recovery_coordinator.dart';

import 'payment_command_test.dart' as payment;
import 'secure_session_store_test.dart' as storage;
import 'session_controller_test.dart' as session;

class RecoveryGateway extends session.FakeGateway {
  @override
  Future<OperatorAccount> signIn({
    required String identifier,
    required String secret,
  }) async => payment.owner;

  @override
  Future<SubscriptionDecision> checkAccess(OperatorAccount account) async =>
      SubscriptionDecision.evaluate(
        response: {
          'ok': true,
          'accessActive': true,
          'serverNow': '2026-11-27T12:00:00Z',
          'generator': {'id': 'g', 'status': 'active'},
          'subscription': {
            'status': 'active',
            'startsAt': '2026-11-01T00:00:00Z',
            'endsAt': '2026-12-01T00:00:00Z',
          },
        },
        expectedGeneratorId: 'g',
        elapsed: Duration.zero,
      );
}

class ArchiveFailureStorage extends storage.MemoryStorage {
  @override
  Future<void> write(String key, String value) async {
    if (key.contains('.receipt.')) throw StateError('Archive failed');
    await super.write(key, value);
  }
}

void main() {
  late SessionController controller;
  late storage.MemoryStorage memory;
  late PendingPaymentStore store;
  late PaymentCommand original;

  setUp(() async {
    controller = SessionController(RecoveryGateway());
    await session.login(controller);
    memory = storage.MemoryStorage();
    store = PendingPaymentStore(
      storage.config('abcdefghijklmnopqrst'),
      memory,
    );
    original = payment.command();
    await store.stage(payment.owner, original);
  });

  tearDown(() => controller.dispose());

  test('unconfirmed and reversed requests stay blocked', () async {
    for (final state in ['unconfirmed', 'reversed']) {
      final recovery = PaymentRecoveryCoordinator(
        controller,
        store,
        (_, command) async => {
          'state': state,
          'requestId': command.payload['requestId'],
        },
      );
      final result = await recovery.recover();
      expect(result.state.name, state);
      expect(result.receipt, isNull);
      expect(await store.load(payment.owner), isNotNull);
    }
  });

  test('committed lookup archives receipt before releasing pending', () async {
    final recovery = PaymentRecoveryCoordinator(
      controller,
      store,
      (_, command) async => {
        'state': 'committed',
        'requestId': command.payload['requestId'],
        'receipt': payment.response(command),
      },
    );
    final result = await recovery.recover();
    expect(result.state, PaymentRecoveryState.committed);
    expect(result.receipt, isNotNull);
    expect(await store.load(payment.owner), isNull);
    expect(memory.values.keys.single, contains('.receipt.'));
  });

  test('archive failure preserves pending request', () async {
    final failing = PendingPaymentStore(
      storage.config('abcdefghijklmnopqrst'),
      ArchiveFailureStorage(),
    );
    await failing.stage(payment.owner, original);
    await expectLater(
      failing.resolve(payment.owner, payment.response(original)),
      throwsStateError,
    );
    expect(await failing.load(payment.owner), isNotNull);
  });

  test('logout during lookup cannot clear pending request', () async {
    final recovery = PaymentRecoveryCoordinator(
      controller,
      store,
      (_, command) async {
        await controller.signOut();
        return {
          'state': 'committed',
          'requestId': command.payload['requestId'],
          'receipt': payment.response(command),
        };
      },
    );
    await expectLater(recovery.recover(), throwsStateError);
    expect(await store.load(payment.owner), isNotNull);
  });
}
