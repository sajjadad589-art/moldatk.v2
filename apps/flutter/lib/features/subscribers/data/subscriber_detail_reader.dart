import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/domain/operator_account.dart';
import '../domain/subscriber_detail.dart';
import 'subscriber_draft_reader.dart';

/// Owner-only financial preview. The server's RLS remains authoritative.
class SubscriberDetailReader {
  const SubscriberDetailReader(this._client);

  final SupabaseClient _client;
  static const limit = 50;

  Future<SubscriberDetail> read(
    OperatorAccount account,
    String subscriberId,
  ) async {
    if (account.role != OperatorRole.owner ||
        _client.auth.currentUser?.id != account.userId ||
        subscriberId.trim().isEmpty) {
      throw StateError('Detail unavailable');
    }
    final before = await _epoch(account);
    final row = await _client
        .from('generator_subscribers')
        .select(
          'id,generator_id,code,full_name,phone,amperes,line_name,'
          'is_exempted,tier,payment_status,amount_due',
        )
        .eq('generator_id', account.generatorId)
        .eq('id', subscriberId)
        .single();
    final invoices = await _client
        .from('generator_invoices')
        .select(
          'id,generator_id,subscriber_id,month_id,status,'
          'total_amount,paid_amount,remaining_amount',
        )
        .eq('generator_id', account.generatorId)
        .eq('subscriber_id', subscriberId)
        .order('month_id', ascending: false)
        .order('id')
        .limit(limit + 1);
    final after = await _epoch(account);
    if (before != after || _client.auth.currentUser?.id != account.userId) {
      throw StateError('Detail snapshot changed');
    }
    return SubscriberDetail.decode(
      generatorId: account.generatorId,
      subscriberId: subscriberId,
      row: row,
      invoiceRows: invoices,
      limit: limit,
    );
  }

  Future<int> _epoch(OperatorAccount account) async {
    return SubscriberDraftReader.decodeEpoch(
      await _client.rpc(
        'get_generator_sync_state',
        params: {'p_generator_id': account.generatorId},
      ),
    );
  }
}
