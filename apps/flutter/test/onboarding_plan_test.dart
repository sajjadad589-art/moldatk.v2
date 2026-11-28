import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/subscribers/domain/onboarding_plan.dart';

OnboardingPlan plan({
  OnboardingDebtMode mode = OnboardingDebtMode.none,
  String tier = 'normal',
  int discount = 2,
  bool pricing = true,
  OnboardingTariff? tariff,
}) {
  return OnboardingPlan.calculate(
    currentMonth: '2026-11',
    tier: tier,
    amperes: 10,
    discountAmperes: discount,
    hasCurrentPricing: pricing,
    mode: mode,
    priorTariff: tariff,
  );
}

const historical = OnboardingTariff(
  monthId: '2026-10',
  tier: 'normal',
  pricePerAmpere: 10000,
  fixedFee: 5000,
);

void main() {
  test('no prior debt creates a zero onboarding marker', () {
    final result = plan();
    expect(result.amountDue, 0);
    expect(result.charges.single.status, 'paid');
    expect(
      result.charges.single.marker,
      'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=no_prior_debt',
    );
  });

  test('permanent free tier never creates debt', () {
    final result = plan(mode: OnboardingDebtMode.free, tier: 'free');
    expect(result.amountDue, 0);
    expect(result.charges.single.status, 'free');
  });

  test('older debt uses historical price and prevents double billing', () {
    final result = plan(mode: OnboardingDebtMode.prior, tariff: historical);
    expect(result.gross, 105000);
    expect(result.discount, 20000);
    expect(result.amountDue, 85000);
    expect(result.charges.length, 2);
    expect(result.charges.first.monthId, '2026-11');
    expect(result.charges.first.total, 0);
    expect(result.charges.last.total, 85000);
  });

  test('same month debt produces only one invoice draft', () {
    final result = plan(
      mode: OnboardingDebtMode.prior,
      tariff: const OnboardingTariff(
        monthId: '2026-11',
        tier: 'normal',
        pricePerAmpere: 10000,
        fixedFee: 0,
      ),
    );
    expect(result.charges.single.total, 80000);
  });

  test('missing pricing and invalid debt inputs fail closed', () {
    expect(() => plan(pricing: false), throwsFormatException);
    expect(() => plan(discount: 11), throwsFormatException);
    expect(() => plan(tier: 'free'), throwsFormatException);
    expect(() => plan(mode: OnboardingDebtMode.prior), throwsFormatException);
    expect(() => plan(tariff: historical), throwsFormatException);
    expect(
      () => plan(
        mode: OnboardingDebtMode.prior,
        tariff: const OnboardingTariff(
          monthId: '2026-12',
          tier: 'normal',
          pricePerAmpere: 10000,
          fixedFee: 0,
        ),
      ),
      throwsFormatException,
    );
  });
}
