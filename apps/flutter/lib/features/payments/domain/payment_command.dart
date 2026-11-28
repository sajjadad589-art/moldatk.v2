import 'dart:math';

import '../../auth/domain/operator_account.dart';
import '../../subscribers/domain/subscriber_detail.dart';
import 'payment_plan.dart';

/// Immutable payment preview. No network transport or write is enabled here.
class PaymentCommand {
  PaymentCommand._({
    required this.actorId,
    required this.generatorId,
    required this.epoch,
    required this.plan,
    required this.payload,
  });

  final String actorId;
  final String generatorId;
  final int epoch;
  final PaymentPlan plan;
  final Map<String, Object?> payload;

  factory PaymentCommand.prepare({
    required OperatorAccount account,
    required SubscriberDetail detail,
    required String activeMonth,
    required bool hasActiveTariff,
    required int amount,
  }) {
    final version = detail.updatedAt;
    final epoch = detail.syncEpoch;
    if (account.role != OperatorRole.owner ||
        account.generatorId != detail.subscriber.generatorId ||
        version == null ||
        epoch == null) {
      throw const FormatException('Payment scope unavailable');
    }
    final invoices =
        detail.invoices.map((invoice) {
          return PayableInvoice(
            id: invoice.id,
            month: invoice.month,
            status: invoice.status,
            total: invoice.total,
            paid: invoice.paid,
            remaining: invoice.remaining,
          );
        }).toList()..sort((a, b) {
          final byMonth = a.month.compareTo(b.month);
          return byMonth == 0 ? a.id.compareTo(b.id) : byMonth;
        });
    final plan = PaymentPlan.calculate(
      activeMonth: activeMonth,
      amount: amount,
      recordedOutstanding: detail.amountDue,
      completeHistory: !detail.hasMore,
      hasActiveTariff: hasActiveTariff,
      invoices: invoices,
    );
    final random = Random.secure();
    final bytes = List.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    final requestId =
        '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
    return PaymentCommand._(
      actorId: account.userId,
      generatorId: account.generatorId,
      epoch: epoch,
      plan: plan,
      payload: Map.unmodifiable({
        'requestId': requestId,
        'subscriberId': detail.subscriber.id,
        'expectedUpdatedAt': version,
        'expectedMonth': activeMonth,
        'amountIqd': amount,
        'expectedLedger': List.unmodifiable(
          invoices.map(
            (i) => Map<String, Object?>.unmodifiable({
              'id': i.id,
              'month': i.month,
              'status': i.status,
              'total': i.total,
              'paid': i.paid,
              'remaining': i.remaining,
            }),
          ),
        ),
      }),
    );
  }

  /// Local recovery is not an authorization grant. The original immutable
  /// request must be reconciled with the server before another is created.
  factory PaymentCommand.restore(
    Object? value, {
    required OperatorAccount account,
  }) {
    if (value is! Map ||
        value.length != 5 ||
        value['v'] != 1 ||
        value['actorId'] != account.userId ||
        value['generatorId'] != account.generatorId ||
        account.role != OperatorRole.owner ||
        value['epoch'] is! int ||
        (value['epoch'] as int) < 0 ||
        value['payload'] is! Map) {
      throw const FormatException('Invalid pending payment scope');
    }
    final raw = value['payload'] as Map;
    final requestId = raw['requestId'];
    final sid = raw['subscriberId'];
    final version = raw['expectedUpdatedAt'];
    final month = raw['expectedMonth'];
    final amount = raw['amountIqd'];
    final ledger = raw['expectedLedger'];
    if (raw.length != 6 ||
        requestId is! String ||
        !RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ).hasMatch(requestId) ||
        sid is! String ||
        sid.trim().isEmpty ||
        version is! String ||
        DateTime.tryParse(version) == null ||
        !RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(version) ||
        month is! String ||
        amount is! int ||
        ledger is! List ||
        ledger.isEmpty ||
        ledger.length > 100) {
      throw const FormatException('Invalid pending payment payload');
    }
    final invoices = <PayableInvoice>[];
    final frozen = <Map<String, Object?>>[];
    var due = 0;
    for (final row in ledger) {
      if (row is! Map ||
          row.length != 6 ||
          row['id'] is! String ||
          row['month'] is! String ||
          row['status'] is! String ||
          row['total'] is! int ||
          row['paid'] is! int ||
          row['remaining'] is! int) {
        throw const FormatException('Invalid pending invoice');
      }
      final invoice = PayableInvoice(
        id: row['id'] as String,
        month: row['month'] as String,
        status: row['status'] as String,
        total: row['total'] as int,
        paid: row['paid'] as int,
        remaining: row['remaining'] as int,
      );
      if (invoices.isNotEmpty) {
        final previous = invoices.last;
        final order = previous.month.compareTo(invoice.month);
        if (order > 0 ||
            (order == 0 && previous.id.compareTo(invoice.id) >= 0)) {
          throw const FormatException('Invalid pending invoice order');
        }
      }
      invoices.add(invoice);
      if (invoice.status != 'cancelled') due += invoice.remaining;
      frozen.add(
        Map<String, Object?>.unmodifiable({
          'id': invoice.id,
          'month': invoice.month,
          'status': invoice.status,
          'total': invoice.total,
          'paid': invoice.paid,
          'remaining': invoice.remaining,
        }),
      );
    }
    final plan = PaymentPlan.calculate(
      activeMonth: month,
      amount: amount,
      recordedOutstanding: due,
      completeHistory: true,
      hasActiveTariff: true,
      invoices: invoices,
    );
    return PaymentCommand._(
      actorId: account.userId,
      generatorId: account.generatorId,
      epoch: value['epoch'] as int,
      plan: plan,
      payload: Map.unmodifiable({
        'requestId': requestId,
        'subscriberId': sid,
        'expectedUpdatedAt': version,
        'expectedMonth': month,
        'amountIqd': amount,
        'expectedLedger': List.unmodifiable(frozen),
      }),
    );
  }

  Map<String, Object?> toRecoveryJson() => Map.unmodifiable({
    'v': 1,
    'actorId': actorId,
    'generatorId': generatorId,
    'epoch': epoch,
    'payload': payload,
  });

  Map<String, String> get headers =>
      Map.unmodifiable({'x-moldatk-sync-epoch': epoch.toString()});

  Map<String, Object?> get arguments =>
      Map.unmodifiable({'p_command': payload, 'p_expected_epoch': epoch});

  void assertAccount(OperatorAccount account) {
    if (account.role != OperatorRole.owner ||
        account.userId != actorId ||
        account.generatorId != generatorId) {
      throw StateError('Payment account mismatch');
    }
  }
}

class VerifiedPaymentReceipt {
  const VerifiedPaymentReceipt._({
    required this.paymentId,
    required this.receiptNumber,
    required this.receivedAt,
    required this.replayed,
  });

  final String paymentId;
  final String receiptNumber;
  final DateTime receivedAt;
  final bool replayed;

  factory VerifiedPaymentReceipt.decode(
    Object? value, {
    required PaymentCommand command,
  }) {
    final plan = command.plan;
    if (value is! Map ||
        value['ok'] != true ||
        value['requestId'] != command.payload['requestId'] ||
        value['generatorId'] != command.generatorId ||
        value['subscriberId'] != command.payload['subscriberId'] ||
        value['replayed'] is! bool) {
      throw const FormatException('Payment receipt scope mismatch');
    }
    final expected = {
      'amountIqd': plan.received,
      'debtBefore': plan.debtBefore,
      'debtAfter': plan.debtAfter,
      'previousDebtBefore': plan.previousDebtBefore,
      'currentCharge': plan.currentCharge,
      'appliedToPrevious': plan.appliedToPrevious,
      'appliedToCurrent': plan.appliedToCurrent,
    };
    for (final entry in expected.entries) {
      if (value[entry.key] is! int || value[entry.key] != entry.value) {
        throw const FormatException('Payment receipt amounts mismatch');
      }
    }
    final allocations = value['allocations'];
    if (allocations is! List || allocations.length != plan.allocations.length) {
      throw const FormatException('Payment receipt allocation mismatch');
    }
    for (var i = 0; i < allocations.length; i++) {
      final actual = allocations[i];
      final expected = plan.allocations[i];
      if (actual is! Map ||
          actual['invoiceId'] != expected.invoiceId ||
          actual['month'] != expected.month ||
          actual['amount'] is! int ||
          actual['amount'] != expected.amount) {
        throw const FormatException('Payment receipt allocation mismatch');
      }
    }
    final paymentId = value['paymentId'];
    final receiptNumber = value['receiptNumber'];
    final timestamp = value['receivedAt'];
    if (paymentId is! String ||
        paymentId != 'flutter-pay-${command.payload['requestId']}' ||
        receiptNumber is! String ||
        receiptNumber != 'REC-${command.payload['requestId']}' ||
        timestamp is! String ||
        !RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(timestamp)) {
      throw const FormatException('Payment receipt identity mismatch');
    }
    final received = DateTime.tryParse(timestamp);
    if (received == null) {
      throw const FormatException('Invalid receipt timestamp');
    }
    return VerifiedPaymentReceipt._(
      paymentId: paymentId,
      receiptNumber: receiptNumber,
      receivedAt: received,
      replayed: value['replayed'] as bool,
    );
  }
}
