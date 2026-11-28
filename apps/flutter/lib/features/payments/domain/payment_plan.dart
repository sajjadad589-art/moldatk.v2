/// Pure payment preview. The server must independently allocate on locked
/// invoices and commit payment, allocations, balances, audit and receipt.
class PayableInvoice {
  const PayableInvoice({
    required this.id,
    required this.month,
    required this.status,
    required this.total,
    required this.paid,
    required this.remaining,
  });

  final String id;
  final String month;
  final String status;
  final int total;
  final int paid;
  final int remaining;
}

class PaymentAllocation {
  const PaymentAllocation({
    required this.invoiceId,
    required this.month,
    required this.amount,
    required this.paidAfter,
    required this.remainingAfter,
  });

  final String invoiceId;
  final String month;
  final int amount;
  final int paidAfter;
  final int remainingAfter;

  String get statusAfter => remainingAfter == 0 ? 'paid' : 'partial';
}

class PaymentPlan {
  PaymentPlan._({
    required this.received,
    required this.debtBefore,
    required this.debtAfter,
    required this.previousDebtBefore,
    required this.currentCharge,
    required this.appliedToPrevious,
    required this.appliedToCurrent,
    required this.currentPaidAfter,
    required List<PaymentAllocation> allocations,
  }) : allocations = List.unmodifiable(allocations);

  final int received;
  final int debtBefore;
  final int debtAfter;
  final int previousDebtBefore;
  final int currentCharge;
  final int appliedToPrevious;
  final int appliedToCurrent;
  final int currentPaidAfter;
  final List<PaymentAllocation> allocations;

  String get subscriberStatus => debtAfter == 0 ? 'paid' : 'partial';

  static PaymentPlan calculate({
    required String activeMonth,
    required int amount,
    required int recordedOutstanding,
    required bool completeHistory,
    required bool hasActiveTariff,
    required List<PayableInvoice> invoices,
  }) {
    final monthPattern = RegExp(r'^\d{4}-(0[1-9]|1[0-2])$');
    if (!completeHistory ||
        !hasActiveTariff ||
        !monthPattern.hasMatch(activeMonth) ||
        amount <= 0 ||
        recordedOutstanding < 0) {
      throw const FormatException('Invalid payment context');
    }
    final ids = <String>{};
    final months = <String>{};
    final payable = <PayableInvoice>[];
    var debt = 0;
    var previousDebt = 0;
    PayableInvoice? current;
    for (final invoice in invoices) {
      if (invoice.id.trim().isEmpty ||
          !ids.add(invoice.id) ||
          !monthPattern.hasMatch(invoice.month) ||
          invoice.month.compareTo(activeMonth) > 0 ||
          invoice.total < 0 ||
          invoice.paid < 0 ||
          invoice.remaining < 0 ||
          !const {
            'paid',
            'partial',
            'unpaid',
            'free',
            'cancelled',
          }.contains(invoice.status)) {
        throw const FormatException('Invalid invoice');
      }
      if (invoice.status == 'cancelled') continue;
      if (!months.add(invoice.month) ||
          invoice.paid + invoice.remaining != invoice.total ||
          (invoice.status == 'paid' && invoice.remaining != 0) ||
          (invoice.status == 'free' && invoice.total != 0) ||
          (invoice.status == 'unpaid' && invoice.paid != 0) ||
          (invoice.status == 'partial' &&
              (invoice.paid <= 0 || invoice.remaining <= 0))) {
        throw const FormatException('Inconsistent invoice ledger');
      }
      debt += invoice.remaining;
      if (invoice.month == activeMonth) {
        current = invoice;
      } else {
        previousDebt += invoice.remaining;
      }
      if (invoice.remaining > 0) payable.add(invoice);
    }
    if (current == null ||
        debt != recordedOutstanding ||
        amount > debt ||
        debt <= 0) {
      throw const FormatException('Payment amount or ledger mismatch');
    }
    payable.sort((a, b) => a.month.compareTo(b.month));
    var left = amount;
    var appliedPrevious = 0;
    var appliedCurrent = 0;
    final allocations = <PaymentAllocation>[];
    for (final invoice in payable) {
      if (left == 0) break;
      final applied = left < invoice.remaining ? left : invoice.remaining;
      left -= applied;
      if (invoice.month == activeMonth) {
        appliedCurrent += applied;
      } else {
        appliedPrevious += applied;
      }
      allocations.add(PaymentAllocation(
        invoiceId: invoice.id,
        month: invoice.month,
        amount: applied,
        paidAfter: invoice.paid + applied,
        remainingAfter: invoice.remaining - applied,
      ));
    }
    if (left != 0 || appliedPrevious + appliedCurrent != amount) {
      throw const FormatException('Allocation mismatch');
    }
    return PaymentPlan._(
      received: amount,
      debtBefore: debt,
      debtAfter: debt - amount,
      previousDebtBefore: previousDebt,
      currentCharge: current.total,
      appliedToPrevious: appliedPrevious,
      appliedToCurrent: appliedCurrent,
      currentPaidAfter: current.paid + appliedCurrent,
      allocations: allocations,
    );
  }
}
