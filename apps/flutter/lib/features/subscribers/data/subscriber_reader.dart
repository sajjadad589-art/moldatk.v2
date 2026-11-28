import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/domain/operator_account.dart';
import '../domain/subscriber.dart';

typedef ReadSubscriberRows =
    Future<List<Map<String, dynamic>>> Function({
      required String generatorId,
      required String? afterId,
      required int limit,
    });

/// Read-only query layer. The caller must serialize this with session changes,
/// enforce a fresh server access check and discard results after logout.
/// RLS, not the tenant filter or client role, is the authorization boundary.
class SubscriberReader {
  const SubscriberReader(this._readRows);

  final ReadSubscriberRows _readRows;

  static SubscriberReader authenticated(SupabaseClient client) {
    return SubscriberReader(({
      required generatorId,
      required afterId,
      required limit,
    }) async {
      var query = client
          .from('generator_subscribers')
          .select(
            'id,generator_id,code,full_name,phone,amperes,line_name,is_exempted',
          )
          .eq('generator_id', generatorId);
      if (afterId != null) query = query.gt('id', afterId);
      return await query.order('id', ascending: true).limit(limit);
    });
  }

  Future<SubscriberPage> readPage({
    required OperatorAccount account,
    String? afterId,
    int pageSize = 50,
  }) async {
    if (pageSize < 1 || pageSize > 100 || afterId == '') {
      throw const FormatException('Invalid pagination');
    }
    final rows = await _readRows(
      generatorId: account.generatorId,
      afterId: afterId,
      limit: pageSize + 1,
    );
    if (rows.length > pageSize + 1) {
      throw const FormatException('Unexpected page length');
    }
    final seen = <String>{};
    final items = <Subscriber>[];
    for (final row in rows) {
      final item = Subscriber.fromRow(
        row,
        expectedGeneratorId: account.generatorId,
      );
      if (!seen.add(item.id) || item.id == afterId) {
        throw const FormatException('Unexpected duplicate subscriber');
      }
      items.add(item);
    }
    final hasMore = items.length > pageSize;
    final page = items.take(pageSize).toList();
    return SubscriberPage(page, nextCursor: hasMore ? page.last.id : null);
  }
}
