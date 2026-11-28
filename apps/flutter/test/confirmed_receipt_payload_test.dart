import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/printing/domain/confirmed_receipt_payload.dart';

import 'payment_command_test.dart' as fixture;

void main() {
  final command = fixture.command();

  Map<String, Object?> status({String state = 'committed'}) => {
    'state': state,
    'requestId': command.payload['requestId'],
    'receipt': {
      ...fixture.response(command),
      'printData': {
        'subscriberName': 'Original name',
        'subscriberCode': '01',
        'phone': '',
        'lineName': 'A',
        'amperes': 5,
        'collectorName': 'Owner',
        'monthNameAr': 'تشرين الثاني',
        'pricePerAmpere': 8000,
      },
    },
  };

  test('receipt fields preserve confirmed money and original identity', () {
    final payload = ConfirmedReceiptPayload.fromStatus(
      account: fixture.owner,
      command: command,
      status: status(),
    );
    expect(payload.fields['paidAmount'], '45000 د.ع');
    expect(payload.fields['totalOutstandingAfter'], '25000 د.ع');
    expect(payload.fields['appliedToPreviousDebt'], '30000 د.ع');
    expect(payload.fields['subscriberName'], 'Original name');
    expect(payload.fields['issueDate'], '2026-11-28 03:00');
    expect(payload.fields['showQr'], isFalse);
    expect(() => payload.fields['paidAmount'] = '0', throwsUnsupportedError);
  });

  test('unconfirmed or reversed payment cannot produce a print payload', () {
    for (final state in ['unconfirmed', 'reversed']) {
      expect(
        () => ConfirmedReceiptPayload.fromStatus(
          account: fixture.owner,
          command: command,
          status: status(state: state),
        ),
        throwsFormatException,
      );
    }
  });

  test('missing original snapshot cannot produce a print payload', () {
    expect(
      () => ConfirmedReceiptPayload.fromStatus(
        account: fixture.owner,
        command: command,
        status: {
          'state': 'committed',
          'requestId': command.payload['requestId'],
          'receipt': fixture.response(command),
        },
      ),
      throwsFormatException,
    );
  });
}
