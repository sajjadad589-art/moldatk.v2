import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/subscribers/data/subscriber_draft_reader.dart';

OperatorAccount account({bool collector = false}) => OperatorAccount.fromJson({
  'userId': 'u',
  'generatorId': 'g',
  'generatorName': 'Test',
  'role': collector ? 'collector' : 'generator_admin',
});

final lines = [
  {'id': 'l1', 'generator_id': 'g', 'name': 'One'},
  {'id': 'l2', 'generator_id': 'g', 'name': 'Two'},
];

Map<String, dynamic> tariff(String month, {bool active = true}) => {
  'id': month,
  'generator_id': 'g',
  'is_current_active': active,
  'tiers': [
    {
      'id': 'normal',
      'type': 'normal',
      'nameAr': 'عادي',
      'pricePerAmpere': 10000,
      'fixedFee': 0,
    },
  ],
};

void main() {
  test('owner reads explicit active tariff and all scoped lines', () {
    final options = SubscriberDraftReader.decode(
      account: account(),
      lines: lines,
      tariffs: [
        tariff('2026-10', active: false),
        tariff('2026-11'),
      ],
    );
    expect(options.currentMonth, '2026-11');
    expect(options.hasPricing, isTrue);
    expect(options.canAdd, isTrue);
    expect(options.lines.length, 2);
    expect(options.history.length, 2);
  });

  test('collector choices follow explicit permissions and assignments', () {
    final options = SubscriberDraftReader.decode(
      account: account(collector: true),
      lines: lines,
      tariffs: [tariff('2026-11')],
      collector: {
        'id': 'u',
        'generator_id': 'g',
        'is_active': true,
        'permissions': {'canAddSubscribers': true},
        'assigned_line_ids': ['l2'],
      },
    );
    expect(options.canAdd, isTrue);
    expect(options.canApplyFree, isFalse);
    expect(options.lines.single.id, 'l2');
  });

  test('no active tariff prevents previews without fallback', () {
    final options = SubscriberDraftReader.decode(
      account: account(),
      lines: lines,
      tariffs: [tariff('2026-10', active: false)],
    );
    expect(options.hasPricing, isFalse);
    expect(options.tiers, isEmpty);
  });

  test('ambiguous active or foreign rows fail closed', () {
    expect(
      () => SubscriberDraftReader.decode(
        account: account(),
        lines: lines,
        tariffs: [tariff('2026-10'), tariff('2026-11')],
      ),
      throwsFormatException,
    );
    expect(
      () => SubscriberDraftReader.decode(
        account: account(),
        lines: [
          {'id': 'x', 'generator_id': 'foreign', 'name': 'Foreign'},
        ],
        tariffs: [tariff('2026-11')],
      ),
      throwsFormatException,
    );
  });
}
