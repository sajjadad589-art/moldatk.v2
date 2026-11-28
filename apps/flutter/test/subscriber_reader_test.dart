import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/subscribers/data/subscriber_reader.dart';

final owner = OperatorAccount.fromJson({
  'userId': 'fixture-user',
  'generatorId': 'fixture-generator',
  'generatorName': 'Fixture',
  'role': 'generator_admin',
});

Map<String, dynamic> row(String id, {String tenant = 'fixture-generator'}) => {
  'id': id,
  'generator_id': tenant,
  'code': 'CODE-$id',
  'full_name': 'Fixture $id',
  'phone': '',
  'amperes': 5,
  'line_name': null,
  'is_exempted': false,
};

void main() {
  test('read-only page requests the account tenant and extra row', () async {
    final reader = SubscriberReader(
      ({
        required generatorId,
        required afterId,
        required limit,
      }) async {
        expect(generatorId, owner.generatorId);
        expect(afterId, 'a');
        expect(limit, 3);
        return [row('b'), row('c'), row('d')];
      },
    );
    final page = await reader.readPage(
      account: owner,
      afterId: 'a',
      pageSize: 2,
    );
    expect(page.items.map((item) => item.id), ['b', 'c']);
    expect(page.nextCursor, 'c');
  });

  test('foreign tenant anywhere in the page rejects the entire result', () async {
    final reader = SubscriberReader(
      ({
        required generatorId,
        required afterId,
        required limit,
      }) async => [row('a'), row('b', tenant: 'foreign')],
    );
    await expectLater(
      reader.readPage(account: owner, pageSize: 1),
      throwsFormatException,
    );
  });

  test('duplicates and invalid values fail closed', () async {
    final duplicate = SubscriberReader(
      ({
        required generatorId,
        required afterId,
        required limit,
      }) async => [row('a'), row('a')],
    );
    await expectLater(duplicate.readPage(account: owner), throwsFormatException);
    final invalid = SubscriberReader(
      ({
        required generatorId,
        required afterId,
        required limit,
      }) async => [row('a')..['amperes'] = -1],
    );
    await expectLater(invalid.readPage(account: owner), throwsFormatException);
  });

  test('empty page is valid and pagination is bounded', () async {
    final reader = SubscriberReader(
      ({
        required generatorId,
        required afterId,
        required limit,
      }) async => [],
    );
    final page = await reader.readPage(account: owner);
    expect(page.items, isEmpty);
    expect(page.nextCursor, isNull);
    await expectLater(
      reader.readPage(account: owner, pageSize: 101),
      throwsFormatException,
    );
  });
}
