import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/subscribers/domain/onboarding_plan.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_create_command.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_create_intent.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_draft.dart';

OperatorAccount account({
  String user = 'owner',
  String tenant = 'g',
  bool collector = false,
}) => OperatorAccount.fromJson({
  'userId': user,
  'generatorId': tenant,
  'generatorName': 'Test',
  'role': collector ? 'collector' : 'generator_admin',
});

SubscriberCreateCommand command() => SubscriberCreateCommand.prepare(
  context: SubscriberDraftContext(
    currentMonth: '2026-11',
    hasPricing: true,
    canAdd: true,
    canApplyFree: false,
    tiers: const [
      SubscriberTierOption(id: 'normal', type: 'normal', name: 'Normal'),
    ],
    lines: const [SubscriberLineOption('line', 'Line')],
    history: const [],
  ),
  name: 'Test',
  code: '',
  phone: '',
  tierId: 'normal',
  lineId: 'line',
  amperes: 5,
  discountAmperes: 0,
  mode: OnboardingDebtMode.none,
);

void main() {
  test('intent captures one epoch and stable request for retries', () async {
    var reads = 0;
    final intent = await SubscriberCreateIntent.prepare(
      account: account(),
      command: command(),
      readState: (tenant) async {
        expect(tenant, 'g');
        reads++;
        return {'authorized': true, 'epoch': 7};
      },
    );
    expect(intent.headers['x-moldatk-sync-epoch'], '7');
    expect(intent.arguments['p_expected_epoch'], 7);
    expect(intent.arguments['p_command'], intent.command.payload);
    expect(reads, 1);
    expect(() => intent.headers['x-moldatk-sync-epoch'] = '8',
        throwsUnsupportedError);
  });

  test('invalid or unauthorized epochs are rejected', () async {
    for (final value in [
      {'authorized': false, 'epoch': 0},
      {'authorized': true, 'epoch': -1},
      {'authorized': true, 'epoch': '0'},
      {'authorized': true},
    ]) {
      await expectLater(
        SubscriberCreateIntent.prepare(
          account: account(),
          command: command(),
          readState: (_) async => value,
        ),
        throwsFormatException,
      );
    }
  });

  test('collector cannot prepare or use an owner-only intent', () async {
    await expectLater(
      SubscriberCreateIntent.prepare(
        account: account(collector: true),
        command: command(),
        readState: (_) async => throw StateError('Must not read'),
      ),
      throwsStateError,
    );
    final intent = await SubscriberCreateIntent.prepare(
      account: account(),
      command: command(),
      readState: (_) async => {'authorized': true, 'epoch': 0},
    );
    intent.assertAccount(account());
    expect(() => intent.assertAccount(account(collector: true)), throwsStateError);
    expect(() => intent.assertAccount(account(user: 'other')), throwsStateError);
    expect(() => intent.assertAccount(account(tenant: 'other')), throwsStateError);
  });
}
