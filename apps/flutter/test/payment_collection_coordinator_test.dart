import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/session_controller.dart';
import 'package:moldatk_flutter/features/payments/data/pending_payment_store.dart';
import 'package:moldatk_flutter/features/payments/data/staging_payment_rpc.dart';
import 'package:moldatk_flutter/features/payments/domain/payment_collection_coordinator.dart';

import 'payment_command_test.dart' as payment;
import 'payment_recovery_coordinator_test.dart' as recovery;
import 'secure_session_store_test.dart' as storage;
import 'session_controller_test.dart' as session;

void main() {
  late SessionController controller;
  late PendingPaymentStore store;

  setUp(() async {
    controller = SessionController(recovery.RecoveryGateway());
    await session.login(controller);
    store = PendingPaymentStore(
      storage.config('abcdefghijklmnopqrst'),
      storage.MemoryStorage(),
    );
  });

  tearDown(() => controller.dispose());

  test('persists request before dispatch and archives confirmed reply', () async {
    final command = payment.command();
    var calls = 0;
    final coordinator = PaymentCollectionCoordinator(controller, store, (
      account,
      request,
    ) async {
      calls++;
      expect((await store.load(account))?.payload, request.payload);
      return payment.response(request);
    });
    final receipt = await coordinator.collect(command);
    expect(receipt.paymentId, payment.response(command)['paymentId']);
    expect(calls, 1);
    expect(await store.load(payment.owner), isNull);
  });

  test('lost response blocks a second collection, including same request', () async {
    final command = payment.command();
    var calls = 0;
    final coordinator = PaymentCollectionCoordinator(controller, store, (
      _,
      _,
    ) async {
      calls++;
      throw StateError('Response lost');
    });
    await expectLater(
      coordinator.collect(command),
      throwsA(isA<WriteOutcomeUnknown>()),
    );
    expect(await store.load(payment.owner), isNotNull);
    await controller.revalidate();
    await expectLater(coordinator.collect(command), throwsStateError);
    expect(calls, 1);
  });

  test('wrong receipt cannot clear pending operation', () async {
    final command = payment.command();
    final coordinator = PaymentCollectionCoordinator(
      controller,
      store,
      (_, request) async => {
        ...payment.response(request),
        'amountIqd': 1,
      },
    );
    await expectLater(
      coordinator.collect(command),
      throwsA(isA<WriteOutcomeUnknown>()),
    );
    expect(await store.load(payment.owner), isNotNull);
  });

  test('hosted payment transport is disabled in default builds', () async {
    final rpc = StagingPaymentRpc(storage.config('abcdefghijklmnopqrst'));
    expect(StagingPaymentRpc.enabled, isFalse);
    await expectLater(
      rpc.call(
        operation: PaymentRpcOperation.collect,
        account: payment.owner,
        command: payment.command(),
        accessToken: 'fixture',
      ),
      throwsStateError,
    );
  });
}
