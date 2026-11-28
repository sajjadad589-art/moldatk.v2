import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/subscribers/domain/onboarding_plan.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_create_command.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_draft.dart';

const requestId = 'f4261250-2d91-4b10-8a40-112233445566';

SubscriberCreateCommand command({String? id = requestId}) {
  return SubscriberCreateCommand.prepare(
    context: SubscriberDraftContext(
      currentMonth: '2026-11',
      syncEpoch: 0,
      hasPricing: true,
      canAdd: true,
      canApplyFree: false,
      tiers: const [
        SubscriberTierOption(id: 'normal', type: 'normal', name: 'Normal'),
      ],
      lines: const [SubscriberLineOption('line', 'Line')],
      history: const [],
    ),
    name: ' Test ',
    code: '',
    phone: '',
    tierId: 'normal',
    lineId: 'line',
    amperes: 5,
    discountAmperes: 0,
    mode: OnboardingDebtMode.none,
    requestId: id,
  );
}

Map<String, Object?> receipt() => {
  'ok': true,
  'requestId': requestId,
  'generatorId': 'g',
  'subscriberId': 'sub-1',
  'amountDueIqd': 0,
  'replayed': false,
};

void main() {
  test('command is immutable and does not send invoice or tenant rows', () {
    final value = command();
    expect(value.payload['requestId'], requestId);
    expect(value.payload['fullName'], 'Test');
    expect(value.payload['code'], isNull);
    expect(value.payload['expectedDebtIqd'], 0);
    expect(value.payload.containsKey('generatorId'), isFalse);
    expect(value.payload.containsKey('invoices'), isFalse);
    expect(() => value.payload['amperes'] = 6, throwsUnsupportedError);
  });

  test('new commands have distinct valid request identifiers', () {
    final a = command(id: null);
    final b = command(id: null);
    expect(a.requestId, isNot(b.requestId));
    expect(() => command(id: 'invalid'), throwsFormatException);
  });

  test('valid receipt and replay identify the same request', () {
    final value = command();
    final result = SubscriberCreateReceipt.decode(
      receipt(),
      command: value,
      expectedGeneratorId: 'g',
    );
    expect(result.subscriberId, 'sub-1');
    final replay = SubscriberCreateReceipt.decode(
      {...receipt(), 'replayed': true},
      command: value,
      expectedGeneratorId: 'g',
    );
    expect(replay.replayed, isTrue);
    expect(replay.subscriberId, result.subscriberId);
  });

  test('wrong request, tenant, or amount cannot be treated as success', () {
    final value = command();
    for (final patch in [
      {'requestId': 'other'},
      {'generatorId': 'other'},
      {'amountDueIqd': 1},
      {'ok': false},
    ]) {
      expect(
        () => SubscriberCreateReceipt.decode(
          {...receipt(), ...patch},
          command: value,
          expectedGeneratorId: 'g',
        ),
        throwsFormatException,
      );
    }
  });
}
