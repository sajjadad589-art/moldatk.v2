/// A calculation preview only. The server must repeat the calculation on
/// locked rows and verify the complete invoice history before any mutation.
class ServiceEditInvoice {
  const ServiceEditInvoice({
    required this.id,
    required this.month,
    required this.status,
    required this.total,
    required this.paid,
    required this.remaining,
    this.notes = '',
  });

  final String id;
  final String month;
  final String status;
  final int total;
  final int paid;
  final int remaining;
  final String notes;

  bool get protected =>
      status == 'paid' ||
      status == 'free' ||
      notes.contains('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE') ||
      notes.contains('MOLDATK_LUMP_SETTLEMENT');
}

class ServiceEditPlan {
  const ServiceEditPlan._({
    required this.currentInvoiceId,
    required this.reprice,
    required this.newGross,
    required this.newDiscount,
    required this.newCurrentTotal,
    required this.currentPaid,
    required this.newCurrentRemaining,
    required this.totalOutstanding,
    required this.paymentStatus,
  });

  final String currentInvoiceId;
  final bool reprice;
  final int newGross;
  final int newDiscount;
  final int newCurrentTotal;
  final int currentPaid;
  final int newCurrentRemaining;
  final int totalOutstanding;
  final String paymentStatus;

  /// Discount is represented as half-ampere units: 3 means 1.5 A.
  /// The preview deliberately rejects fractional IQD rather than rounding.
  static ServiceEditPlan calculate({
    required String currentMonth,
    required String existingTier,
    required String newTier,
    required int amperes,
    required int discountHalfAmperes,
    required int pricePerAmpere,
    required int fixedFee,
    required bool completeHistory,
    required List<ServiceEditInvoice> invoices,
  }) {
    final monthPattern = RegExp(r'^\d{4}-(0[1-9]|1[0-2])$');
    const tiers = {'normal', 'commercial', 'golden', 'custom', 'free'};
    if (!completeHistory ||
        !monthPattern.hasMatch(currentMonth) ||
        !tiers.contains(existingTier) ||
        !tiers.contains(newTier) ||
        amperes <= 0 ||
        discountHalfAmperes < 0 ||
        discountHalfAmperes > amperes * 2 ||
        pricePerAmpere < 0 ||
        fixedFee < 0) {
      throw const FormatException('Invalid service edit context');
    }
    // Free-tier transitions affect liabilities and require a separate workflow.
    if ((existingTier == 'free') != (newTier == 'free') ||
        (newTier == 'free' && discountHalfAmperes != 0)) {
      throw const FormatException('Free transition requires explicit review');
    }
    final ids = <String>{};
    final months = <String>{};
    ServiceEditInvoice? current;
    var oldOutstanding = 0;
    var historicalPartial = false;
    for (final invoice in invoices) {
      if (invoice.id.isEmpty ||
          !ids.add(invoice.id) ||
          !monthPattern.hasMatch(invoice.month) ||
          invoice.month.compareTo(currentMonth) > 0 ||
          !const {
            'paid',
            'partial',
            'unpaid',
            'free',
            'cancelled',
          }.contains(invoice.status) ||
          invoice.total < 0 ||
          invoice.paid < 0 ||
          invoice.remaining < 0) {
        throw const FormatException('Invalid invoice history');
      }
      if (invoice.status == 'cancelled') continue;
      if (!months.add(invoice.month) ||
          invoice.paid + invoice.remaining != invoice.total ||
          ((invoice.status == 'paid' || invoice.status == 'free') &&
              invoice.remaining != 0) ||
          (invoice.status == 'free' && invoice.total != 0) ||
          (invoice.status == 'unpaid' && invoice.paid != 0) ||
          (invoice.status == 'partial' &&
              (invoice.paid <= 0 || invoice.remaining <= 0))) {
        throw const FormatException('Inconsistent invoice history');
      }
      oldOutstanding += invoice.remaining;
      if (invoice.month == currentMonth) {
        current = invoice;
      } else if (invoice.paid > 0 && invoice.remaining > 0) {
        historicalPartial = true;
      }
    }
    if (current == null) {
      throw const FormatException('Missing current invoice');
    }
    final gross = amperes * pricePerAmpere + fixedFee;
    final discountNumerator = discountHalfAmperes * pricePerAmpere;
    if (discountNumerator.isOdd) {
      throw const FormatException('Fractional IQD requires review');
    }
    final discount = discountNumerator ~/ 2;
    final reprice = !current.protected;
    final total = reprice ? gross - discount : current.total;
    if (total < current.paid) {
      throw const FormatException('Reprice below collected amount');
    }
    final remaining = total - current.paid;
    final due = oldOutstanding - current.remaining + remaining;
    final status = due == 0
        ? (current.status == 'free' ? 'free' : 'paid')
        : (current.paid > 0 || historicalPartial ? 'partial' : 'unpaid');
    return ServiceEditPlan._(
      currentInvoiceId: current.id,
      reprice: reprice,
      newGross: reprice ? gross : 0,
      newDiscount: reprice ? discount : 0,
      newCurrentTotal: total,
      currentPaid: current.paid,
      newCurrentRemaining: remaining,
      totalOutstanding: due,
      paymentStatus: status,
    );
  }
}
