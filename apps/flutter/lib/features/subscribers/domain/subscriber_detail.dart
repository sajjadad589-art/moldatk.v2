import 'subscriber.dart';

class SubscriberInvoiceSummary {
  const SubscriberInvoiceSummary._({
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

  factory SubscriberInvoiceSummary.fromRow(
    Map<String, dynamic> row, {
    required String generatorId,
    required String subscriberId,
  }) {
    if (row['generator_id'] != generatorId ||
        row['subscriber_id'] != subscriberId) {
      throw const FormatException('Invoice scope mismatch');
    }
    final id = row['id'];
    final month = row['month_id'];
    final status = row['status'];
    if (id is! String ||
        id.trim().isEmpty ||
        month is! String ||
        !RegExp(r'^\d{4}-(0[1-9]|1[0-2])$').hasMatch(month) ||
        status is! String ||
        !const {'paid', 'partial', 'unpaid', 'cancelled', 'free'}.contains(status)) {
      throw const FormatException('Invalid invoice summary');
    }
    return SubscriberInvoiceSummary._(
      id: id,
      month: month,
      status: status,
      total: _money(row['total_amount']),
      paid: _money(row['paid_amount']),
      remaining: _money(row['remaining_amount']),
    );
  }
}

class SubscriberDetail {
  SubscriberDetail._({
    required this.subscriber,
    required this.tier,
    required this.paymentStatus,
    required this.amountDue,
    required List<SubscriberInvoiceSummary> invoices,
    required this.hasMore,
  }) : invoices = List.unmodifiable(invoices);

  final Subscriber subscriber;
  final String tier;
  final String paymentStatus;
  final int amountDue;
  final List<SubscriberInvoiceSummary> invoices;
  final bool hasMore;

  factory SubscriberDetail.decode({
    required String generatorId,
    required String subscriberId,
    required Map<String, dynamic> row,
    required List<Map<String, dynamic>> invoiceRows,
    required int limit,
  }) {
    if (limit < 1 || limit > 100 || invoiceRows.length > limit + 1) {
      throw const FormatException('Invalid detail page');
    }
    final subscriber = Subscriber.fromRow(row, expectedGeneratorId: generatorId);
    if (subscriber.id != subscriberId) {
      throw const FormatException('Subscriber identity mismatch');
    }
    final tier = row['tier'];
    final status = row['payment_status'];
    if (tier is! String ||
        !const {'normal', 'commercial', 'golden', 'free', 'custom'}.contains(tier) ||
        status is! String ||
        !const {'paid', 'partial', 'unpaid', 'free'}.contains(status)) {
      throw const FormatException('Invalid subscriber detail');
    }
    final seen = <String>{};
    final invoices = <SubscriberInvoiceSummary>[];
    for (final row in invoiceRows) {
      final invoice = SubscriberInvoiceSummary.fromRow(
        row,
        generatorId: generatorId,
        subscriberId: subscriberId,
      );
      if (!seen.add(invoice.id)) {
        throw const FormatException('Duplicate invoice');
      }
      invoices.add(invoice);
    }
    return SubscriberDetail._(
      subscriber: subscriber,
      tier: tier,
      paymentStatus: status,
      amountDue: _money(row['amount_due']),
      invoices: invoices.take(limit).toList(),
      hasMore: invoices.length > limit,
    );
  }
}

int _money(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Invalid integer IQD amount');
  }
  return value;
}
