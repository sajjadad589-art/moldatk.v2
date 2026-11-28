import '../../auth/domain/operator_account.dart';
import 'subscriber_create_command.dart';

typedef ReadSyncState = Future<Object?> Function(String generatorId);

/// Captures a reset epoch before dispatch. Never replace it on a retry.
class SubscriberCreateIntent {
  const SubscriberCreateIntent._({
    required this.command,
    required this.generatorId,
    required this.actorId,
    required this.epoch,
  });

  final SubscriberCreateCommand command;
  final String generatorId;
  final String actorId;
  final int epoch;

  static Future<SubscriberCreateIntent> prepare({
    required OperatorAccount account,
    required SubscriberCreateCommand command,
    required ReadSyncState readState,
  }) async {
    if (account.role != OperatorRole.owner) {
      throw StateError('Owner authorization required');
    }
    final state = await readState(account.generatorId);
    if (state is! Map ||
        state['authorized'] != true ||
        state['epoch'] is! int ||
        (state['epoch'] as int) < 0) {
      throw const FormatException('Invalid sync epoch');
    }
    return SubscriberCreateIntent._(
      command: command,
      generatorId: account.generatorId,
      actorId: account.userId,
      epoch: state['epoch'] as int,
    );
  }

  Map<String, String> get headers =>
      Map.unmodifiable({'x-moldatk-sync-epoch': epoch.toString()});

  Map<String, Object?> get arguments => Map.unmodifiable({
    'p_command': command.payload,
    'p_expected_epoch': epoch,
  });

  void assertAccount(OperatorAccount account) {
    if (account.role != OperatorRole.owner ||
        account.generatorId != generatorId ||
        account.userId != actorId) {
      throw StateError('Creation intent account mismatch');
    }
  }

  SubscriberCreateReceipt receipt(Object? response) {
    return SubscriberCreateReceipt.decode(
      response,
      command: command,
      expectedGeneratorId: generatorId,
    );
  }
}
