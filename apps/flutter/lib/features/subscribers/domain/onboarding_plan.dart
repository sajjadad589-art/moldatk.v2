enum OnboardingDebtMode { none, prior, free }

/// Integer IQD only. A historical tariff must come from the authorized server.
/// This is a calculation draft, never a persisted invoice or authorization.
class OnboardingTariff {
  const OnboardingTariff({
    required this.monthId,
    required this.tier,
    required this.pricePerAmpere,
    required this.fixedFee,
  });

  final String monthId;
  final String tier;
  final int pricePerAmpere;
  final int fixedFee;
}

class OnboardingCharge {
  const OnboardingCharge({
    required this.monthId,
    required this.status,
    required this.total,
    required this.marker,
  });

  final String monthId;
  final String status;
  final int total;
  final String marker;
}

class OnboardingPlan {
  OnboardingPlan._({
    required this.gross,
    required this.discount,
    required this.amountDue,
    required List<OnboardingCharge> charges,
  }) : charges = List.unmodifiable(charges);

  final int gross;
  final int discount;
  final int amountDue;
  final List<OnboardingCharge> charges;

  static OnboardingPlan calculate({
    required String currentMonth,
    required String tier,
    required int amperes,
    required int discountAmperes,
    required bool hasCurrentPricing,
    required OnboardingDebtMode mode,
    OnboardingTariff? priorTariff,
  }) {
    if (!_validMonth(currentMonth) ||
        tier.trim().isEmpty ||
        amperes <= 0 ||
        discountAmperes < 0 ||
        discountAmperes > amperes ||
        !hasCurrentPricing) {
      throw const FormatException('Invalid onboarding inputs');
    }
    if ((tier == 'free') != (mode == OnboardingDebtMode.free)) {
      throw const FormatException('Free tier mismatch');
    }
    if (mode != OnboardingDebtMode.prior && priorTariff != null) {
      throw const FormatException('Unexpected historical tariff');
    }
    if (mode == OnboardingDebtMode.free) {
      return OnboardingPlan._(
        gross: 0,
        discount: 0,
        amountDue: 0,
        charges: [
          OnboardingCharge(
            monthId: currentMonth,
            status: 'free',
            total: 0,
            marker: 'MOLDATK_ONBOARDING_FREE',
          ),
        ],
      );
    }
    if (mode == OnboardingDebtMode.none) {
      return OnboardingPlan._(
        gross: 0,
        discount: 0,
        amountDue: 0,
        charges: [_zero(currentMonth, 'no_prior_debt')],
      );
    }
    final tariff = priorTariff;
    if (tariff == null ||
        !_validMonth(tariff.monthId) ||
        tariff.monthId.compareTo(currentMonth) > 0 ||
        tariff.tier != tier ||
        tariff.pricePerAmpere < 0 ||
        tariff.fixedFee < 0) {
      throw const FormatException('Invalid historical tariff');
    }
    final gross = amperes * tariff.pricePerAmpere + tariff.fixedFee;
    final discount = discountAmperes * tariff.pricePerAmpere;
    final debt = gross - discount;
    if (debt <= 0) {
      throw const FormatException('Historical debt must be positive');
    }
    final charges = [
      OnboardingCharge(
        monthId: tariff.monthId,
        status: 'unpaid',
        total: debt,
        marker: 'MOLDATK_PRIOR_DEBT_ONBOARDING|month=${tariff.monthId}',
      ),
      if (tariff.monthId != currentMonth)
        _zero(currentMonth, 'prior_debt_other_month'),
    ]..sort((a, b) => b.monthId.compareTo(a.monthId));
    return OnboardingPlan._(
      gross: gross,
      discount: discount,
      amountDue: debt,
      charges: charges,
    );
  }

  static bool _validMonth(String value) =>
      RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(value);

  static OnboardingCharge _zero(String month, String reason) {
    return OnboardingCharge(
      monthId: month,
      status: 'paid',
      total: 0,
      marker: 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=$reason',
    );
  }
}
