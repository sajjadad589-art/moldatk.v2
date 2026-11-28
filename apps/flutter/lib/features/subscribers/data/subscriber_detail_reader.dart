import 'dart:convert';

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
    final tariffBefore = await _tariff(account);
    final row = await _client
        .from('generator_subscribers')
        .select(
          'id,generator_id,code,full_name,phone,amperes,line_name,'
          'is_exempted,tier,payment_status,amount_due,updated_at',
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
    final tariffAfter = await _tariff(account);
    final after = await _epoch(account);
    if (before != after ||
        tariffBefore != tariffAfter ||
        _client.auth.currentUser?.id != account.userId) {
      throw StateError('Detail snapshot changed');
    }
    return SubscriberDetail.decode(
      generatorId: account.generatorId,
      subscriberId: subscriberId,
      row: row,
      invoiceRows: invoices,
      limit: limit,
      syncEpoch: before,
      activeMonth: tariffBefore == null
          ? null
          : (jsonDecode(tariffBefore) as Map)['id'] as String,
    );
  }

  Future<String?> _tariff(OperatorAccount account) async {
    final rows = await _client
        .from('generator_monthly_tariffs')
        .select('id,generator_id,tiers')
        .eq('generator_id', account.generatorId)
        .eq('is_current_active', true)
        .limit(2);
    return decodeTariff(rows, account.generatorId);
  }

  static String? decodeTariff(
    List<Map<String, dynamic>> rows,
    String generatorId,
  ) {
    if (rows.isEmpty) return null;
    if (rows.length != 1) {
      throw const FormatException('Ambiguous active tariff');
    }
    final row = rows.single;
    final id = row['id'];
    final tiers = row['tiers'];
    if (row['generator_id'] != generatorId ||
        id is! String ||
        !RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(id) ||
        tiers is! List) {
      throw const FormatException('Invalid active tariff');
    }
    if (tiers.isEmpty) return null;
    return jsonEncode({'id': id, 'tiers': tiers});
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
