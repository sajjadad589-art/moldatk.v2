import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/subscribers/data/subscriber_detail_reader.dart';

void main() {
  test('one tenant tariff is required for payment preview', () {
    final row = <String, dynamic>{
      'id': '2026-11',
      'generator_id': 'g',
      'tiers': [{'id': 'normal'}],
    };
    expect(SubscriberDetailReader.decodeTariff([], 'g'), isNull);
    expect(
      SubscriberDetailReader.decodeTariff([row], 'g'),
      contains('2026-11'),
    );
    expect(
      () => SubscriberDetailReader.decodeTariff([row, row], 'g'),
      throwsFormatException,
    );
    expect(
      () => SubscriberDetailReader.decodeTariff([row], 'foreign'),
      throwsFormatException,
    );
    expect(
      SubscriberDetailReader.decodeTariff([
        {...row, 'tiers': []},
      ], 'g'),
      isNull,
    );
  });
}
