import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/subscribers/domain/service_edit_plan.dart';

const history = ServiceEditInvoice(
  id: 'old',
  month: '2026-10',
  status: 'unpaid',
  total: 20000,
  paid: 0,
  remaining: 20000,
);

ServiceEditInvoice current({
  String status = 'partial',
  int total = 50000,
  int paid = 10000,
  int remaining = 40000,
  String notes = '',
}) => ServiceEditInvoice(
  id: 'current',
  month: '2026-11',
  status: status,
  total: total,
  paid: paid,
  remaining: remaining,
  notes: notes,
);

ServiceEditPlan plan(
  List<ServiceEditInvoice> invoices, {
  int amperes = 6,
  int discount = 3,
  int rate = 10000,
  bool complete = true,
  String tier = 'normal',
}) => ServiceEditPlan.calculate(
  currentMonth: '2026-11',
  existingTier: 'normal',
  newTier: tier,
  amperes: amperes,
  discountHalfAmperes: discount,
  pricePerAmpere: rate,
  fixedFee: 5000,
  completeHistory: complete,
  invoices: invoices,
);

void main() {
  test('reprices only current invoice and preserves collected cash', () {
    final result = plan([history, current()]);
    expect(result.reprice, isTrue);
    expect(result.newGross, 65000);
    expect(result.newDiscount, 15000);
    expect(result.newCurrentTotal, 50000);
    expect(result.currentPaid, 10000);
    expect(result.newCurrentRemaining, 40000);
    expect(result.totalOutstanding, 60000);
    expect(result.paymentStatus, 'partial');
  });

  test('paid current invoice is immutable', () {
    final result = plan([
      history,
      current(status: 'paid', paid: 50000, remaining: 0),
    ], amperes: 10);
    expect(result.reprice, isFalse);
    expect(result.newCurrentTotal, 50000);
    expect(result.currentPaid, 50000);
    expect(result.totalOutstanding, 20000);
  });

  test('zero-charge onboarding and settlement markers are preserved', () {
    for (final marker in [
      'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE',
      'MOLDATK_LUMP_SETTLEMENT',
    ]) {
      final result = plan([
        history,
        current(status: 'unpaid', total: 0, paid: 0, remaining: 0, notes: marker),
      ]);
      expect(result.reprice, isFalse);
      expect(result.totalOutstanding, 20000);
    }
  });

  test('reducing a charge below collected cash is blocked', () {
    expect(
      () => plan([current()], amperes: 1, discount: 2),
      throwsFormatException,
    );
  });

  test('truncated history, missing current invoice and duplicates are blocked', () {
    expect(() => plan([current()], complete: false), throwsFormatException);
    expect(() => plan([history]), throwsFormatException);
    expect(() => plan([current(), current()]), throwsFormatException);
  });

  test('free transition and fractional IQD are blocked', () {
    expect(() => plan([current()], tier: 'free'), throwsFormatException);
    expect(() => plan([current()], rate: 10001), throwsFormatException);
  });

  test('cancelled invoice is excluded from outstanding amount', () {
    const cancelled = ServiceEditInvoice(
      id: 'cancelled',
      month: '2026-10',
      status: 'cancelled',
      total: 10000,
      paid: 0,
      remaining: 10000,
    );
    final result = plan([cancelled, current()]);
    expect(result.totalOutstanding, 40000);
  });
}
