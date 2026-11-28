import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/subscribers/domain/onboarding_plan.dart';
import 'package:moldatk_flutter/features/subscribers/domain/subscriber_draft.dart';

SubscriberDraftContext options({bool canAdd = true, bool canFree = false}) {
  return SubscriberDraftContext(
    currentMonth: '2026-11',
    hasPricing: true,
    canAdd: canAdd,
    canApplyFree: canFree,
    tiers: const [
      SubscriberTierOption(id: 'a', type: 'normal', name: 'Normal A'),
      SubscriberTierOption(id: 'b', type: 'normal', name: 'Normal B'),
      SubscriberTierOption(id: 'f', type: 'free', name: 'Free'),
    ],
    lines: const [SubscriberLineOption('line-a', 'Line A')],
    history: const [
      HistoricalTierOption(
        'a',
        OnboardingTariff(
          monthId: '2026-10',
          tier: 'normal',
          pricePerAmpere: 10000,
          fixedFee: 0,
        ),
      ),
    ],
  );
}

SubscriberDraft preview(
  SubscriberDraftContext context, {
  String tier = 'a',
  String line = 'line-a',
  OnboardingDebtMode mode = OnboardingDebtMode.none,
  String? month,
}) {
  return context.preview(
    name: ' Test ',
    code: ' MW-1001 ',
    phone: ' 07700000000 ',
    tierId: tier,
    lineId: line,
    amperes: 10,
    discountAmperes: 2,
    mode: mode,
    priorMonth: month,
  );
}

void main() {
  test('draft uses selected line and exact tariff identity', () {
    final result = preview(
      options(),
      mode: OnboardingDebtMode.prior,
      month: '2026-10',
    );
    expect(result.name, 'Test');
    expect(result.line.id, 'line-a');
    expect(result.plan.amountDue, 80000);
  });

  test('same tier type cannot substitute a different tariff id', () {
    expect(
      () => preview(
        options(),
        tier: 'b',
        mode: OnboardingDebtMode.prior,
        month: '2026-10',
      ),
      throwsFormatException,
    );
  });

  test('unauthorized creation and unknown line are rejected', () {
    expect(() => preview(options(canAdd: false)), throwsFormatException);
    expect(() => preview(options(), line: 'foreign'), throwsFormatException);
  });

  test('free draft requires permission and zeroes discount', () {
    expect(
      () => preview(options(), tier: 'f', mode: OnboardingDebtMode.free),
      throwsFormatException,
    );
    final result = preview(
      options(canFree: true),
      tier: 'f',
      mode: OnboardingDebtMode.free,
    );
    expect(result.discountAmperes, 0);
    expect(result.plan.amountDue, 0);
  });
}
