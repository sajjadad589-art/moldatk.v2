import 'dart:math';

import 'onboarding_plan.dart';
import 'subscriber_draft.dart';

/// Immutable command for a future atomic server endpoint. Not a database row.
/// Reuse the same instance for a retry after an ambiguous transport failure.
class SubscriberCreateCommand {
  SubscriberCreateCommand._(this.requestId, this.epoch, this.payload);

  final String requestId;
  final int epoch;
  final Map<String, Object?> payload;

  factory SubscriberCreateCommand.prepare({
    required SubscriberDraftContext context,
    required String name,
    required String code,
    required String phone,
    required String tierId,
    required String lineId,
    required int amperes,
    required int discountAmperes,
    required OnboardingDebtMode mode,
    String? priorMonth,
    String? requestId,
  }) {
    final epoch = context.syncEpoch;
    if (epoch == null || epoch < 0) {
      throw const FormatException('Missing verified reset epoch');
    }
    final id = requestId ?? _newId();
    if (!RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    ).hasMatch(id)) {
      throw const FormatException('Invalid request id');
    }
    final draft = context.preview(
      name: name,
      code: code,
      phone: phone,
      tierId: tierId,
      lineId: lineId,
      amperes: amperes,
      discountAmperes: discountAmperes,
      mode: mode,
      priorMonth: priorMonth,
    );
    return SubscriberCreateCommand._(
      id,
      epoch,
      Map.unmodifiable({
        'requestId': id,
        'fullName': draft.name,
        'code': draft.code.isEmpty ? null : draft.code,
        'phone': draft.phone,
        'tierId': draft.tier.id,
        'lineId': draft.line.id,
        'amperes': draft.amperes,
        'discountAmperes': draft.discountAmperes,
        'debtMode': mode.name,
        'priorMonth': priorMonth,
        'expectedCurrentMonth': context.currentMonth,
        // A confirmation guard, never an authoritative charge.
        'expectedDebtIqd': draft.plan.amountDue,
      }),
    );
  }

  static String _newId() {
    final random = Random.secure();
    final bytes = List.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }
}

/// A receipt must identify the same request and tenant. Never infer success
/// from HTTP status alone or from a local draft.
class SubscriberCreateReceipt {
  const SubscriberCreateReceipt._(this.subscriberId, this.replayed);

  final String subscriberId;
  final bool replayed;

  factory SubscriberCreateReceipt.decode(
    Object? response, {
    required SubscriberCreateCommand command,
    required String expectedGeneratorId,
  }) {
    if (response is! Map ||
        response['ok'] != true ||
        response['requestId'] != command.requestId ||
        expectedGeneratorId.trim().isEmpty ||
        response['generatorId'] != expectedGeneratorId ||
        response['amountDueIqd'] is! int ||
        response['amountDueIqd'] != command.payload['expectedDebtIqd'] ||
        response['replayed'] is! bool) {
      throw const FormatException('Unverified creation receipt');
    }
    final subscriberId = response['subscriberId'];
    if (subscriberId is! String || subscriberId.trim().isEmpty) {
      throw const FormatException('Missing subscriber id');
    }
    return SubscriberCreateReceipt._(
      subscriberId,
      response['replayed'] as bool,
    );
  }
}
