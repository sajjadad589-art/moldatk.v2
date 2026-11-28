import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/payments/domain/payment_plan.dart';

const old = PayableInvoice(
  id: 'old',
  month: '2026-10',
  status: 'unpaid',
  total: 30000,
  paid: 0,
  remaining: 30000,
);
const current = PayableInvoice(
  id: 'current',
  month: '2026-11',
  status: 'partial',
  total: 50000,
  paid: 10000,
  remaining: 40000,
);

PaymentPlan plan({
  int amount = 45000,
  int due = 70000,
  bool complete = true,
  bool pricing = true,
  List<PayableInvoice> invoices = const [current, old],
}) => PaymentPlan.calculate(
  activeMonth: '2026-11',
  amount: amount,
  recordedOutstanding: due,
  completeHistory: complete,
  hasActiveTariff: pricing,
  invoices: invoices,
);

void main() {
  test('oldest debt first, preserving previously collected cash', () {
    final result = plan();
    expect(result.allocations.map((a) => a.invoiceId), ['old', 'current']);
    expect(result.appliedToPrevious, 30000);
    expect(result.appliedToCurrent, 15000);
    expect(result.currentPaidAfter, 25000);
    expect(result.debtAfter, 25000);
    expect(result.allocations.first.statusAfter, 'paid');
    expect(result.allocations.last.statusAfter, 'partial');
    expect(result.subscriberStatus, 'partial');
  });

  test('full payment clears debt exactly', () {
    final result = plan(amount: 70000);
    expect(result.debtAfter, 0);
    expect(result.received, 70000);
    expect(result.subscriberStatus, 'paid');
    expect(result.allocations.every((a) => a.remainingAfter == 0), isTrue);
  });

  test('partial payment does not touch the current month prematurely', () {
    final result = plan(amount: 10000);
    expect(result.allocations.single.invoiceId, 'old');
    expect(result.currentPaidAfter, 10000);
    expect(result.appliedToCurrent, 0);
    expect(result.debtAfter, 60000);
  });

  test('zero and excessive payments are rejected', () {
    for (final amount in [0, -1, 70001]) {
      expect(() => plan(amount: amount), throwsFormatException);
    }
  });

  test('incomplete, inconsistent or unpriced ledger is rejected', () {
    expect(() => plan(complete: false), throwsFormatException);
    expect(() => plan(pricing: false), throwsFormatException);
    expect(() => plan(due: 70001), throwsFormatException);
    expect(() => plan(invoices: [old]), throwsFormatException);
    expect(() => plan(invoices: [old, current, old]), throwsFormatException);
  });

  test('free current month allows settling historical debt', () {
    const free = PayableInvoice(
      id: 'free',
      month: '2026-11',
      status: 'free',
      total: 0,
      paid: 0,
      remaining: 0,
    );
    final result = plan(
      amount: 30000,
      due: 30000,
      invoices: [free, old],
    );
    expect(result.currentCharge, 0);
    expect(result.appliedToCurrent, 0);
    expect(result.debtAfter, 0);
  });

  test('cancelled invoice does not enter payment allocation', () {
    const cancelled = PayableInvoice(
      id: 'cancelled',
      month: '2026-09',
      status: 'cancelled',
      total: 100000,
      paid: 0,
      remaining: 100000,
    );
    final result = plan(invoices: [cancelled, current, old]);
    expect(result.debtBefore, 70000);
    expect(result.allocations.any((a) => a.invoiceId == 'cancelled'), isFalse);
  });
}
