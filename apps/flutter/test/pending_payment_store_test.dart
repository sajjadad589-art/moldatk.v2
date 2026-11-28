import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/payments/data/pending_payment_store.dart';

import 'payment_command_test.dart' as fixture;
import 'secure_session_store_test.dart' as storage_fixture;

void main() {
  final other = OperatorAccount.fromJson({
    'userId': 'other',
    'generatorId': 'g',
    'generatorName': 'Fixture',
    'role': 'generator_admin',
  });

  test('restores identical request and money after process restart', () async {
    final storage = storage_fixture.MemoryStorage();
    final config = storage_fixture.config('abcdefghijklmnopqrst');
    final original = fixture.command();
    await PendingPaymentStore(config, storage).stage(fixture.owner, original);
    final restarted = PendingPaymentStore(config, storage);
    final restored = await restarted.load(fixture.owner);
    expect(restored?.payload, original.payload);
    expect(restored?.plan.debtAfter, original.plan.debtAfter);
    expect(await restarted.load(other), isNull);
  });

  test('unknown outcome blocks a second payment request', () async {
    final store = PendingPaymentStore(
      storage_fixture.config('abcdefghijklmnopqrst'),
      storage_fixture.MemoryStorage(),
    );
    final original = fixture.command();
    await store.stage(fixture.owner, original);
    await store.stage(fixture.owner, original);
    await expectLater(
      store.stage(fixture.owner, fixture.command()),
      throwsStateError,
    );
    expect((await store.load(fixture.owner))?.payload, original.payload);
  });

  test('only the matching verified receipt clears the pending slot', () async {
    final store = PendingPaymentStore(
      storage_fixture.config('abcdefghijklmnopqrst'),
      storage_fixture.MemoryStorage(),
    );
    final original = fixture.command();
    await store.stage(fixture.owner, original);
    await expectLater(
      store.resolve(fixture.owner, {
        ...fixture.response(original),
        'amountIqd': 1,
      }),
      throwsFormatException,
    );
    expect(await store.load(fixture.owner), isNotNull);
    final receipt = await store.resolve(fixture.owner, fixture.response(original));
    expect(receipt.receiptNumber, fixture.response(original)['receiptNumber']);
    expect(await store.load(fixture.owner), isNull);
  });

  test('corrupted pending operation is preserved and blocks replacement', () async {
    final storage = storage_fixture.MemoryStorage();
    final store = PendingPaymentStore(
      storage_fixture.config('abcdefghijklmnopqrst'),
      storage,
    );
    await store.stage(fixture.owner, fixture.command());
    final key = storage.values.keys.single;
    storage.values[key] = '{bad';
    await expectLater(store.load(fixture.owner), throwsFormatException);
    await expectLater(
      store.stage(fixture.owner, fixture.command()),
      throwsFormatException,
    );
    expect(storage.values[key], '{bad');
  });

  test('different staging projects cannot load each other', () async {
    final storage = storage_fixture.MemoryStorage();
    final first = PendingPaymentStore(
      storage_fixture.config('abcdefghijklmnopqrst'),
      storage,
    );
    final second = PendingPaymentStore(
      storage_fixture.config('bcdefghijklmnopqrstu'),
      storage,
    );
    await first.stage(fixture.owner, fixture.command());
    expect(await second.load(fixture.owner), isNull);
    expect(await first.load(fixture.owner), isNotNull);
  });
}
