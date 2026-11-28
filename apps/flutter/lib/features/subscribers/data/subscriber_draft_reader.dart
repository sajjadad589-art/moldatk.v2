import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/domain/operator_account.dart';
import '../domain/onboarding_plan.dart';
import '../domain/subscriber_draft.dart';

/// Read-only staging adapter. Invoke via the serialized session boundary.
class SubscriberDraftReader {
  const SubscriberDraftReader(this._client);

  final SupabaseClient _client;
  static const maxRows = 500;

  Future<SubscriberDraftContext> read(OperatorAccount account) async {
    if (_client.auth.currentUser?.id != account.userId) {
      throw StateError('Session unavailable');
    }
    final firstEpoch = await _readEpoch(account);
    final lines = await _client
        .from('generator_lines')
        .select('id,generator_id,name')
        .eq('generator_id', account.generatorId)
        .limit(maxRows + 1);
    final tariffs = await _client
        .from('generator_monthly_tariffs')
        .select('id,generator_id,is_current_active,tiers')
        .eq('generator_id', account.generatorId)
        .limit(maxRows + 1);
    final collector = account.role == OperatorRole.collector
        ? await _client
              .from('generator_collectors')
              .select(
                'id,generator_id,is_active,permissions,assigned_line_id,'
                'assigned_line_ids,assigned_all_lines',
              )
              .eq('generator_id', account.generatorId)
              .eq('id', account.userId)
              .single()
        : null;
    final lastEpoch = await _readEpoch(account);
    if (_client.auth.currentUser?.id != account.userId ||
        firstEpoch != lastEpoch) {
      throw StateError('Session or reset epoch changed');
    }
    return decode(
      account: account,
      lines: lines,
      tariffs: tariffs,
      collector: collector,
      syncEpoch: firstEpoch,
    );
  }

  Future<int> _readEpoch(OperatorAccount account) async {
    final state = await _client.rpc(
      'get_generator_sync_state',
      params: {'p_generator_id': account.generatorId},
    );
    return decodeEpoch(state);
  }

  static int decodeEpoch(Object? state) {
    if (state is! Map ||
        state['authorized'] != true ||
        state['epoch'] is! int ||
        (state['epoch'] as int) < 0) {
      throw const FormatException('Invalid sync epoch');
    }
    return state['epoch'] as int;
  }

  static SubscriberDraftContext decode({
    required OperatorAccount account,
    required List<Map<String, dynamic>> lines,
    required List<Map<String, dynamic>> tariffs,
    Map<String, dynamic>? collector,
    int? syncEpoch,
  }) {
    if (lines.length > maxRows || tariffs.length > maxRows) {
      throw const FormatException('Incomplete option snapshot');
    }
    var canAdd = account.role == OperatorRole.owner;
    var canFree = canAdd;
    var allLines = canAdd;
    final assigned = <String>{};
    if (account.role == OperatorRole.collector) {
      if (collector == null ||
          collector['id'] != account.userId ||
          collector['generator_id'] != account.generatorId ||
          collector['is_active'] != true ||
          collector['permissions'] is! Map) {
        throw const FormatException('Invalid collector context');
      }
      final permissions = collector['permissions'] as Map;
      canAdd = permissions['canAddSubscribers'] == true;
      canFree = permissions['canApplyFreeExemption'] == true;
      allLines = collector['assigned_all_lines'] == true;
      final one = collector['assigned_line_id'];
      if (one != null) assigned.add(_text(one));
      final many = collector['assigned_line_ids'];
      if (many != null) {
        if (many is! List) throw const FormatException('Invalid line scope');
        assigned.addAll(many.map(_text));
      }
    }
    final lineIds = <String>{};
    final options = <SubscriberLineOption>[];
    for (final row in lines) {
      _tenant(row, account);
      final id = _text(row['id']);
      final name = _text(row['name']);
      if (!lineIds.add(id)) throw const FormatException('Duplicate line');
      if (allLines || assigned.contains(id)) {
        options.add(SubscriberLineOption(id, name));
      }
    }
    final active = <String>[];
    final months = <String>{};
    final current = <SubscriberTierOption>[];
    final history = <HistoricalTierOption>[];
    for (final row in tariffs) {
      _tenant(row, account);
      final month = _text(row['id']);
      if (!RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(month) ||
          !months.add(month) ||
          row['is_current_active'] is! bool ||
          row['tiers'] is! List) {
        throw const FormatException('Invalid tariff snapshot');
      }
      final isActive = row['is_current_active'] == true;
      if (isActive) active.add(month);
      final ids = <String>{};
      for (final raw in row['tiers'] as List) {
        if (raw is! Map) throw const FormatException('Invalid tier');
        final id = _text(raw['id']);
        final type = _text(raw['type']);
        final name = _text(raw['nameAr']);
        if (!ids.add(id) ||
            !const {
              'normal',
              'commercial',
              'golden',
              'free',
              'custom',
            }.contains(type)) {
          throw const FormatException('Invalid tier identity');
        }
        final tariff = OnboardingTariff(
          monthId: month,
          tier: type,
          pricePerAmpere: _money(raw['pricePerAmpere']),
          fixedFee: _money(raw['fixedFee']),
        );
        history.add(HistoricalTierOption(id, tariff));
        if (isActive) {
          current.add(SubscriberTierOption(id: id, type: type, name: name));
        }
      }
    }
    if (active.length > 1) {
      throw const FormatException('Ambiguous active tariff');
    }
    final month = active.isEmpty ? '' : active.single;
    return SubscriberDraftContext(
      currentMonth: month,
      syncEpoch: syncEpoch,
      hasPricing: active.length == 1 && current.isNotEmpty,
      canAdd: canAdd,
      canApplyFree: canFree,
      tiers: current,
      lines: options,
      history: history
          .where((item) => item.tariff.monthId.compareTo(month) <= 0)
          .toList(),
    );
  }

  static void _tenant(Map row, OperatorAccount account) {
    if (row['generator_id'] != account.generatorId) {
      throw const FormatException('Foreign generator row');
    }
  }

  static String _text(Object? value) {
    if (value is! String || value.trim().isEmpty) {
      throw const FormatException('Invalid option text');
    }
    return value;
  }

  static int _money(Object? value) {
    if (value is! int || value < 0) {
      throw const FormatException('Invalid integer tariff');
    }
    return value;
  }
}
