import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/payments/domain/payment_command.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_detail.dart';

final owner = OperatorAccount.fromJson({
  'userId': 'owner',
  'generatorId': 'g',
  'generatorName': 'Fixture',
  'role': 'generator_admin',
});

SubscriberDetail detail({int limit = 2, int? epoch = 1}) =>
    SubscriberDetail.decode(
      generatorId: 'g',
      subscriberId: 's',
      row: {
        'id': 's',
        'generator_id': 'g',
        'code': '1',
        'full_name': 'Fixture',
        'phone': '',
        'amperes': 5,
        'line_name': 'A',
        'is_exempted': false,
        'tier': 'normal',
        'payment_status': 'unpaid',
        'amount_due': 70000,
        'updated_at': '2026-11-28T00:00:00Z',
      },
      invoiceRows: [
        {
          'id': 'current',
          'generator_id': 'g',
          'subscriber_id': 's',
          'month_id': '2026-11',
          'status': 'unpaid',
          'total_amount': 40000,
          'paid_amount': 0,
          'remaining_amount': 40000,
        },
        {
          'id': 'old',
          'generator_id': 'g',
          'subscriber_id': 's',
          'month_id': '2026-10',
          'status': 'unpaid',
          'total_amount': 30000,
          'paid_amount': 0,
          'remaining_amount': 30000,
        },
      ],
      limit: limit,
      syncEpoch: epoch,
    );

PaymentCommand command({SubscriberDetail? source}) => PaymentCommand.prepare(
  account: owner,
  detail: source ?? detail(),
  activeMonth: '2026-11',
  hasActiveTariff: true,
  amount: 45000,
);

Map<String, Object?> response(PaymentCommand value) => {
  'ok': true,
  'requestId': value.payload['requestId'],
  'generatorId': 'g',
  'subscriberId': 's',
  'paymentId': 'flutter-pay-${value.payload['requestId']}',
  'receiptNumber': 'REC-${value.payload['requestId']}',
  'receivedAt': '2026-11-28T00:00:00+00:00',
  'amountIqd': 45000,
  'debtBefore': 70000,
  'debtAfter': 25000,
  'previousDebtBefore': 30000,
  'currentCharge': 40000,
  'appliedToPrevious': 30000,
  'appliedToCurrent': 15000,
  'allocations': [
    {'invoiceId': 'old', 'month': '2026-10', 'amount': 30000},
    {'invoiceId': 'current', 'month': '2026-11', 'amount': 15000},
  ],
  'replayed': false,
};

void main() {
  test('command freezes the canonical complete invoice ledger', () {
    final value = command();
    final ledger = value.payload['expectedLedger'] as List;
    expect(ledger.first['id'], 'old');
    expect(value.headers['x-moldatk-sync-epoch'], '1');
    expect(() => ledger.clear(), throwsUnsupportedError);
    expect(() => ledger.first['remaining'] = 0, throwsUnsupportedError);
    expect(() => value.payload['amountIqd'] = 1, throwsUnsupportedError);
  });

  test('missing epoch or incomplete history cannot prepare a payment', () {
    expect(() => command(source: detail(epoch: null)), throwsFormatException);
    expect(() => command(source: detail(limit: 1)), throwsFormatException);
  });

  test('valid receipt and replay identify one payment', () {
    final value = command();
    final first = VerifiedPaymentReceipt.decode(
      response(value),
      command: value,
    );
    final replay = VerifiedPaymentReceipt.decode({
      ...response(value),
      'replayed': true,
    }, command: value);
    expect(first.paymentId, replay.paymentId);
    expect(replay.replayed, isTrue);
  });

  test('incorrect money, allocation or tenant cannot be printed', () {
    final value = command();
    for (final change in [
      {'amountIqd': 44999},
      {'debtAfter': 0},
      {'generatorId': 'other'},
      {'allocations': []},
      {'receiptNumber': 'wrong'},
    ]) {
      expect(
        () => VerifiedPaymentReceipt.decode({
          ...response(value),
          ...change,
        }, command: value),
        throwsFormatException,
      );
    }
  });
}
