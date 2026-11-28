import 'dart:convert';

import 'onboarding_plan.dart';

class SubscriberTierOption {
  const SubscriberTierOption({
    required this.id,
    required this.type,
    required this.name,
  });

  final String id;
  final String type;
  final String name;
}

class SubscriberLineOption {
  const SubscriberLineOption(this.id, this.name);

  final String id;
  final String name;
}

class HistoricalTierOption {
  const HistoricalTierOption(this.tierId, this.tariff);

  final String tierId;
  final OnboardingTariff tariff;
}

/// Must be populated from an authorized server snapshot, not device settings.
/// This context validates previews; it grants no database write permissions.
class SubscriberDraftContext {
  SubscriberDraftContext({
    required this.currentMonth,
    required this.hasPricing,
    required this.canAdd,
    required this.canApplyFree,
    required List<SubscriberTierOption> tiers,
    required List<SubscriberLineOption> lines,
    required List<HistoricalTierOption> history,
  }) : tiers = List.unmodifiable(tiers),
       lines = List.unmodifiable(lines),
       history = List.unmodifiable(history);

  final String currentMonth;
  final bool hasPricing;
  final bool canAdd;
  final bool canApplyFree;
  final List<SubscriberTierOption> tiers;
  final List<SubscriberLineOption> lines;
  final List<HistoricalTierOption> history;

  /// Stable identity for invalidating previews when server options change.
  String get snapshotKey => jsonEncode([
    currentMonth,
    hasPricing,
    canAdd,
    canApplyFree,
    tiers.map((t) => jsonEncode([t.id, t.type, t.name])).toList()..sort(),
    lines.map((l) => jsonEncode([l.id, l.name])).toList()..sort(),
    history
        .map(
          (h) => jsonEncode([
            h.tierId,
            h.tariff.monthId,
            h.tariff.tier,
            h.tariff.pricePerAmpere,
            h.tariff.fixedFee,
          ]),
        )
        .toList()
      ..sort(),
  ]);

  SubscriberDraft preview({
    required String name,
    required String code,
    required String phone,
    required String tierId,
    required String lineId,
    required int amperes,
    required int discountAmperes,
    required OnboardingDebtMode? mode,
    String? priorMonth,
  }) {
    if (!canAdd || !hasPricing || name.trim().isEmpty || mode == null) {
      throw const FormatException('Incomplete or unauthorized draft');
    }
    final tier = tiers.singleWhere(
      (item) => item.id == tierId,
      orElse: () => throw const FormatException('Unknown tier'),
    );
    final line = lines.singleWhere(
      (item) => item.id == lineId,
      orElse: () => throw const FormatException('Unknown line'),
    );
    if (tier.type == 'free' && !canApplyFree) {
      throw const FormatException('Free tier not permitted');
    }
    if (mode != OnboardingDebtMode.prior && priorMonth != null) {
      throw const FormatException('Unexpected debt month');
    }
    final tariff = mode == OnboardingDebtMode.prior
        ? history
              .singleWhere(
                (item) =>
                    item.tierId == tier.id && item.tariff.monthId == priorMonth,
                orElse: () => throw const FormatException('Missing tariff'),
              )
              .tariff
        : null;
    final effectiveDiscount = tier.type == 'free' ? 0 : discountAmperes;
    final plan = OnboardingPlan.calculate(
      currentMonth: currentMonth,
      tier: tier.type,
      amperes: amperes,
      discountAmperes: effectiveDiscount,
      hasCurrentPricing: hasPricing,
      mode: mode,
      priorTariff: tariff,
    );
    return SubscriberDraft(
      name: name.trim(),
      code: code.trim(),
      phone: phone.trim(),
      tier: tier,
      line: line,
      amperes: amperes,
      discountAmperes: effectiveDiscount,
      plan: plan,
    );
  }
}

class SubscriberDraft {
  const SubscriberDraft({
    required this.name,
    required this.code,
    required this.phone,
    required this.tier,
    required this.line,
    required this.amperes,
    required this.discountAmperes,
    required this.plan,
  });

  final String name;
  final String code;
  final String phone;
  final SubscriberTierOption tier;
  final SubscriberLineOption line;
  final int amperes;
  final int discountAmperes;
  final OnboardingPlan plan;
}
