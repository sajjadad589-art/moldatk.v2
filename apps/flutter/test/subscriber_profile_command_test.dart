import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_detail.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_profile_command.dart';

OperatorAccount account({
  String role = 'generator_admin',
  String tenant = 'g',
}) => OperatorAccount.fromJson({
  'userId': 'owner',
  'generatorId': tenant,
  'generatorName': 'Fixture',
  'role': role,
});

SubscriberDetail detail({
  int? epoch = 3,
  String? version = '2026-11-28T00:00:00Z',
}) => SubscriberDetail.decode(
  generatorId: 'g',
  subscriberId: 's',
  row: {
    'id': 's',
    'generator_id': 'g',
    'code': '1',
    'full_name': 'Old',
    'phone': '',
    'amperes': 5,
    'line_name': 'A',
    'is_exempted': false,
    'tier': 'normal',
    'payment_status': 'unpaid',
    'amount_due': 10000,
    'updated_at': version,
  },
  invoiceRows: [],
  limit: 1,
  syncEpoch: epoch,
);

SubscriberProfileCommand command() => SubscriberProfileCommand.prepare(
  account: account(),
  detail: detail(),
  name: ' New ',
  phone: ' 07700000000 ',
);

void main() {
  test('edit payload is restricted to identity and version fields', () {
    final value = command();
    expect(value.payload.keys.toSet(), {
      'requestId',
      'subscriberId',
      'fullName',
      'phone',
      'expectedUpdatedAt',
    });
    expect(value.payload['fullName'], 'New');
    expect(value.payload['phone'], '07700000000');
    expect(value.headers['x-moldatk-sync-epoch'], '3');
    expect(value.arguments['p_expected_epoch'], 3);
    expect(() => value.payload['amountDue'] = 0, throwsUnsupportedError);
  });

  test('owner, tenant, verified version and epoch are required', () {
    for (final pair in [
      (account(role: 'collector'), detail()),
      (account(tenant: 'foreign'), detail()),
      (account(), detail(epoch: null)),
      (account(), detail(version: null)),
    ]) {
      expect(
        () => SubscriberProfileCommand.prepare(
          account: pair.$1,
          detail: pair.$2,
          name: 'New',
          phone: '',
        ),
        throwsFormatException,
      );
    }
  });

  test('unchanged or blank name is rejected', () {
    for (final name in ['Old', '  ']) {
      expect(
        () => SubscriberProfileCommand.prepare(
          account: account(),
          detail: detail(),
          name: name,
          phone: '',
        ),
        throwsFormatException,
      );
    }
  });

  test('receipt is bound to request and tenant', () {
    final value = command();
    final response = {
      'ok': true,
      'requestId': value.payload['requestId'],
      'generatorId': 'g',
      'subscriberId': 's',
      'replayed': true,
    };
    expect(value.verifyReceipt(response), isTrue);
    expect(
      () => value.verifyReceipt({...response, 'generatorId': 'other'}),
      throwsFormatException,
    );
    expect(
      () => value.assertAccount(account(tenant: 'other')),
      throwsStateError,
    );
  });
}
