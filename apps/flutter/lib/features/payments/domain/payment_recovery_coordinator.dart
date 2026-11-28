import '../../auth/domain/operator_account.dart';
import '../../auth/domain/session_controller.dart';
import '../data/pending_payment_store.dart';
import 'payment_command.dart';

enum PaymentRecoveryState { noPending, unconfirmed, reversed, committed }

class PaymentRecoveryResult {
  const PaymentRecoveryResult(this.state, {this.receipt});

  final PaymentRecoveryState state;
  final VerifiedPaymentReceipt? receipt;
}

/// Only an authenticated status lookup may be supplied here. The interface
/// deliberately has no collect or retry method, so recovery cannot charge.
typedef PaymentStatusLookup =
    Future<Object?> Function(OperatorAccount account, PaymentCommand command);

class PaymentRecoveryCoordinator {
  const PaymentRecoveryCoordinator(this._session, this._store, this._lookup);

  final SessionController _session;
  final PendingPaymentStore _store;
  final PaymentStatusLookup _lookup;

  Future<PaymentRecoveryResult> recover() async {
    // First validate access and read status. Never clear storage in this
    // callback: the session must pass its post-request authorization check.
    final result = await _session.readAuthorized((account) async {
      if (account.role != OperatorRole.owner) {
        throw StateError('Owner required');
      }
      final pending = await _store.load(account);
      if (pending == null) return null;
      final response = await _lookup(account, pending);
      if (response is! Map ||
          response['requestId'] != pending.payload['requestId']) {
        throw const FormatException('Recovery request mismatch');
      }
      final state = switch (response['state']) {
        'unconfirmed' => PaymentRecoveryState.unconfirmed,
        'reversed' => PaymentRecoveryState.reversed,
        'committed' => PaymentRecoveryState.committed,
        _ => throw const FormatException('Unknown recovery status'),
      };
      if (state == PaymentRecoveryState.committed) {
        VerifiedPaymentReceipt.decode(response['receipt'], command: pending);
      } else if (response.containsKey('receipt')) {
        throw const FormatException('Unexpected active receipt');
      }
      return (pending, state, response['receipt']);
    });
    if (result == null) {
      return const PaymentRecoveryResult(PaymentRecoveryState.noPending);
    }
    final (pending, state, receipt) = result;
    // An unconfirmed or reversed request requires manual reconciliation.
    if (state != PaymentRecoveryState.committed) {
      return PaymentRecoveryResult(state);
    }
    return _session.readAuthorized((account) async {
      pending.assertAccount(account);
      final verified = await _store.resolve(account, receipt);
      return PaymentRecoveryResult(state, receipt: verified);
    });
  }
}
