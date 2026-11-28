import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_detail.dart';

Map<String, dynamic> sub() => {
  'id': 's',
  'generator_id': 'g',
  'code': 'MW-1',
  'full_name': 'Fixture',
  'phone': '',
  'amperes': 5,
  'line_name': 'A',
  'is_exempted': false,
  'tier': 'normal',
  'payment_status': 'unpaid',
  'amount_due': 50000,
};

Map<String, dynamic> invoice(String id) => {
  'id': id,
  'generator_id': 'g',
  'subscriber_id': 's',
  'month_id': '2026-11',
  'status': 'unpaid',
  'total_amount': 50000,
  'paid_amount': 0,
  'remaining_amount': 50000,
};

SubscriberDetail decode(List<Map<String, dynamic>> invoices) =>
    SubscriberDetail.decode(
      generatorId: 'g',
      subscriberId: 's',
      row: sub(),
      invoiceRows: invoices,
      limit: 1,
    );

void main() {
  test(
    'detail preserves server totals and marks truncated invoice history',
    () {
      final result = decode([invoice('a'), invoice('b')]);
      expect(result.amountDue, 50000);
      expect(result.invoices.length, 1);
      expect(result.hasMore, isTrue);
    },
  );

  test('foreign invoice or subscriber and duplicate invoice fail closed', () {
    expect(
      () => decode([
        {...invoice('a'), 'generator_id': 'foreign'},
      ]),
      throwsFormatException,
    );
    expect(
      () => decode([
        {...invoice('a'), 'subscriber_id': 'foreign'},
      ]),
      throwsFormatException,
    );
    expect(() => decode([invoice('a'), invoice('a')]), throwsFormatException);
  });

  test('invalid monetary value is not rounded or displayed', () {
    expect(
      () => decode([
        {...invoice('a'), 'remaining_amount': -1},
      ]),
      throwsFormatException,
    );
  });
}
