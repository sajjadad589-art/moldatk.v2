import '../../auth/domain/operator_account.dart';
import 'subscriber_detail.dart';

enum DeleteBlock {
  incompleteHistory,
  unknownPaymentLinks,
  outstandingDebt,
  recordedPayment,
  financialHistory,
  missingVersion,
}

/// Conservative preflight only. Never authorizes a database deletion.
class SubscriberDeleteReview {
  SubscriberDeleteReview._({
    required this.subscriberId,
    required this.generatorId,
    required this.epoch,
    required this.updatedAt,
    required List<DeleteBlock> reasons,
  }) : reasons = List.unmodifiable(reasons);

  final String subscriberId;
  final String generatorId;
  final int? epoch;
  final String? updatedAt;
  final List<DeleteBlock> reasons;

  bool get canRequestServerReview => reasons.isEmpty;

  factory SubscriberDeleteReview.evaluate({
    required OperatorAccount account,
    required SubscriberDetail detail,
    required int? paymentReferenceCount,
  }) {
    if (account.role != OperatorRole.owner ||
        account.generatorId != detail.subscriber.generatorId) {
      throw StateError('Owner scope required');
    }
    if (paymentReferenceCount != null && paymentReferenceCount < 0) {
      throw const FormatException('Invalid payment reference count');
    }
    final reasons = <DeleteBlock>[];
    if (detail.updatedAt == null || detail.syncEpoch == null) {
      reasons.add(DeleteBlock.missingVersion);
    }
    if (detail.hasMore) reasons.add(DeleteBlock.incompleteHistory);
    if (paymentReferenceCount == null) {
      reasons.add(DeleteBlock.unknownPaymentLinks);
    }
    if (detail.amountDue > 0 ||
        detail.invoices.any((invoice) => invoice.remaining > 0)) {
      reasons.add(DeleteBlock.outstandingDebt);
    }
    if ((paymentReferenceCount ?? 0) > 0 ||
        detail.invoices.any((invoice) => invoice.paid > 0)) {
      reasons.add(DeleteBlock.recordedPayment);
    }
    // Even a cancelled invoice with a nonzero amount is financial history.
    if (detail.invoices.any((invoice) => invoice.total > 0)) {
      reasons.add(DeleteBlock.financialHistory);
    }
    return SubscriberDeleteReview._(
      subscriberId: detail.subscriber.id,
      generatorId: account.generatorId,
      epoch: detail.syncEpoch,
      updatedAt: detail.updatedAt,
      reasons: reasons,
    );
  }
}
