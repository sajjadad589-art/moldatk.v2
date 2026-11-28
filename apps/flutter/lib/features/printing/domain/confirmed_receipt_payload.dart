import '../../auth/domain/operator_account.dart';
import '../../payments/domain/payment_command.dart';

/// Build native renderer fields only from a freshly checked committed status.
/// No physical print or payment dispatch is performed by this class.
class ConfirmedReceiptPayload {
  ConfirmedReceiptPayload._(this.fields);

  final Map<String, Object?> fields;

  factory ConfirmedReceiptPayload.fromStatus({
    required OperatorAccount account,
    required PaymentCommand command,
    required Object? status,
  }) {
    command.assertAccount(account);
    if (status is! Map ||
        status['state'] != 'committed' ||
        status['requestId'] != command.payload['requestId']) {
      throw const FormatException('Payment is not confirmed');
    }
    final raw = status['receipt'];
    final receipt = VerifiedPaymentReceipt.decode(raw, command: command);
    final snapshot = (raw as Map)['printData'];
    if (snapshot is! Map) {
      throw const FormatException('Original print snapshot unavailable');
    }
    String field(String key, int limit, {bool optional = false}) {
      final value = snapshot[key];
      if (value is! String ||
          value.length > limit ||
          (!optional && value.trim().isEmpty)) {
        throw const FormatException('Invalid print identity');
      }
      return value.trim();
    }

    final amperes = snapshot['amperes'];
    final price = snapshot['pricePerAmpere'];
    if (amperes is! int || amperes < 0 || price is! int || price < 0) {
      throw const FormatException('Invalid receipt pricing');
    }
    final plan = command.plan;
    String money(int value) => '$value د.ع';
    final baghdad = receipt.receivedAt.toUtc().add(const Duration(hours: 3));
    String two(int value) => value.toString().padLeft(2, '0');
    final date =
        '${baghdad.year}-${two(baghdad.month)}-${two(baghdad.day)} '
        '${two(baghdad.hour)}:${two(baghdad.minute)}';
    return ConfirmedReceiptPayload._(
      Map.unmodifiable({
        'header': account.generatorName,
        'systemTitle': 'مولدتك',
        'receiptNumber': receipt.receiptNumber,
        'subscriberName': field('subscriberName', 200),
        'subscriberCode': field('subscriberCode', 200),
        'phone': field('phone', 80, optional: true),
        'lineName': field('lineName', 200, optional: true),
        'amperes': amperes.toString(),
        'pricePerAmp': money(price),
        'month': field('monthNameAr', 100),
        'status': plan.debtAfter == 0 ? 'مسدد' : 'مسدد جزئياً',
        'collector': field('collectorName', 200),
        'issueDate': date,
        'totalAmount': money(plan.currentCharge),
        'paidAmount': money(plan.received),
        'previousDebt': money(plan.previousDebtBefore),
        'currentCharge': money(plan.currentCharge),
        'totalBeforePayment': money(plan.debtBefore),
        'appliedToPreviousDebt': money(plan.appliedToPrevious),
        'appliedToCurrentMonth': money(plan.appliedToCurrent),
        'totalOutstandingAfter': money(plan.debtAfter),
        'remainingAmount': money(plan.debtAfter),
        'showAppliedToPreviousDebt': true,
        // QR requires a verified subscriber portal token; never invent one.
        'showQr': false,
      }),
    );
  }
}
