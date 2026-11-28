import 'dart:math';

import '../../auth/domain/operator_account.dart';
import 'subscriber_detail.dart';

/// Profile-only edit preview, never a direct database update.
class SubscriberProfileCommand {
  SubscriberProfileCommand._({
    required this.generatorId,
    required this.actorId,
    required this.epoch,
    required this.payload,
  });

  final String generatorId;
  final String actorId;
  final int epoch;
  final Map<String, Object?> payload;

  factory SubscriberProfileCommand.prepare({
    required OperatorAccount account,
    required SubscriberDetail detail,
    required String name,
    required String phone,
  }) {
    final sub = detail.subscriber;
    final version = detail.updatedAt;
    final epoch = detail.syncEpoch;
    final nextName = name.trim();
    final nextPhone = phone.trim();
    if (account.role != OperatorRole.owner ||
        account.generatorId != sub.generatorId ||
        version == null ||
        epoch == null ||
        nextName.isEmpty ||
        nextName.runes.length > 200 ||
        nextPhone.runes.length > 40 ||
        (nextName == sub.name && nextPhone == sub.phone)) {
      throw const FormatException('Invalid profile edit');
    }
    final random = Random.secure();
    final bytes = List.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    final requestId =
        '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
    return SubscriberProfileCommand._(
      generatorId: account.generatorId,
      actorId: account.userId,
      epoch: epoch,
      payload: Map.unmodifiable({
        'requestId': requestId,
        'subscriberId': sub.id,
        'fullName': nextName,
        'phone': nextPhone,
        'expectedUpdatedAt': version,
      }),
    );
  }

  Map<String, String> get headers =>
      Map.unmodifiable({'x-moldatk-sync-epoch': epoch.toString()});

  Map<String, Object?> get arguments =>
      Map.unmodifiable({'p_command': payload, 'p_expected_epoch': epoch});

  void assertAccount(OperatorAccount account) {
    if (account.role != OperatorRole.owner ||
        account.userId != actorId ||
        account.generatorId != generatorId) {
      throw StateError('Profile edit account mismatch');
    }
  }

  bool verifyReceipt(Object? response) {
    if (response is! Map ||
        response['ok'] != true ||
        response['requestId'] != payload['requestId'] ||
        response['subscriberId'] != payload['subscriberId'] ||
        response['generatorId'] != generatorId ||
        response['replayed'] is! bool) {
      throw const FormatException('Invalid profile receipt');
    }
    return response['replayed'] as bool;
  }
}
