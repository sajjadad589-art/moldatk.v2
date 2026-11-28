import '../../auth/domain/operator_account.dart';
import '../../auth/domain/session_controller.dart';
import '../data/pending_payment_store.dart';
import 'payment_command.dart';

typedef PaymentDispatch =
    Future<Object?> Function(OperatorAccount account, PaymentCommand command);

/// New collection only. An ambiguous request must use the status-only
/// recovery coordinator; never automatically send it again.
class PaymentCollectionCoordinator {
  PaymentCollectionCoordinator(this._session, this._store, this._dispatch);

  final SessionController _session;
  final PendingPaymentStore _store;
  final PaymentDispatch _dispatch;
  bool _busy = false;

  Future<VerifiedPaymentReceipt> collect(PaymentCommand command) async {
    if (_busy) throw StateError('Collection already in progress');
    _busy = true;
    try {
      await _session.readAuthorized((account) async {
        command.assertAccount(account);
        await _store.stageNew(account, command);
      });
      // A new, fresh authorization check is required after local persistence.
      final reply = await _session.writeAuthorized((account) async {
        command.assertAccount(account);
        final response = await _dispatch(account, command);
        VerifiedPaymentReceipt.decode(response, command: command);
        return response;
      });
      try {
        return await _session.readAuthorized((account) async {
          command.assertAccount(account);
          return _store.resolve(account, reply);
        });
      } catch (_) {
        // The remote write may be confirmed even if local archival failed.
        throw const WriteOutcomeUnknown();
      }
    } finally {
      _busy = false;
    }
  }
}
