import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_delete_review.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_detail.dart';

OperatorAccount account({String tenant = 'g', String role = 'generator_admin'}) =>
    OperatorAccount.fromJson({
      'userId': 'owner',
      'generatorId': tenant,
      'generatorName': 'Test',
      'role': role,
    });

Map<String, dynamic> invoice({int total = 0, int paid = 0, int remaining = 0}) => {
  'id': 'i',
  'generator_id': 'g',
  'subscriber_id': 's',
  'month_id': '2026-11',
  'status': 'paid',
  'total_amount': total,
  'paid_amount': paid,
  'remaining_amount': remaining,
};

SubscriberDetail detail({
  int due = 0,
  List<Map<String, dynamic>> invoices = const [],
  int? epoch = 0,
}) => SubscriberDetail.decode(
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
    'payment_status': 'paid',
    'amount_due': due,
    'updated_at': '2026-11-28T00:00:00Z',
  },
  invoiceRows: invoices,
  limit: 1,
  syncEpoch: epoch,
);

SubscriberDeleteReview review(SubscriberDetail value, {int? links = 0}) =>
    SubscriberDeleteReview.evaluate(
      account: account(),
      detail: value,
      paymentReferenceCount: links,
    );

void main() {
  test('zero-charge row can only request a server review', () {
    final result = review(detail(invoices: [invoice()]));
    expect(result.canRequestServerReview, isTrue);
    expect(result.reasons, isEmpty);
  });

  test('unknown payment links fail closed', () {
    final result = review(detail(), links: null);
    expect(result.canRequestServerReview, isFalse);
    expect(result.reasons, contains(DeleteBlock.unknownPaymentLinks));
  });

  test('settled cash or independent payment links block review', () {
    expect(
      review(detail(invoices: [invoice(total: 5000, paid: 5000)])).reasons,
      containsAll([DeleteBlock.recordedPayment, DeleteBlock.financialHistory]),
    );
    expect(review(detail(), links: 1).reasons, contains(DeleteBlock.recordedPayment));
  });

  test('debt and truncated invoice history block review', () {
    final result = review(detail(
      due: 5000,
      invoices: [invoice(), {...invoice(), 'id': 'i2'}],
    ));
    expect(
      result.reasons,
      containsAll([DeleteBlock.outstandingDebt, DeleteBlock.incompleteHistory]),
    );
  });

  test('missing epoch and foreign tenant fail closed', () {
    expect(review(detail(epoch: null)).reasons, contains(DeleteBlock.missingVersion));
    expect(
      () => SubscriberDeleteReview.evaluate(
        account: account(tenant: 'foreign'),
        detail: detail(),
        paymentReferenceCount: 0,
      ),
      throwsStateError,
    );
  });
}
