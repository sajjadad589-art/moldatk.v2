import 'dart:convert';

import '../../auth/data/secure_session_store.dart';
import '../../auth/data/staging_config.dart';
import '../../auth/domain/operator_account.dart';
import '../domain/payment_command.dart';

/// One encrypted pending operation per verified owner and staging project.
/// Use one instance per process. Never discard an ambiguous payment on logout.
/// This is recovery storage, not an offline authorization or a dispatch queue.
class PendingPaymentStore {
  PendingPaymentStore(StagingConfig config, this._storage)
    : _project = Uri.parse(config.url).host;

  final String _project;
  final SecretStorage _storage;
  bool _busy = false;

  String _key(OperatorAccount account) {
    if (account.role != OperatorRole.owner) {
      throw StateError('Owner required');
    }
    final scope = base64Url.encode(
      utf8.encode(jsonEncode([account.generatorId, account.userId])),
    );
    return 'moldatk.pending-payment.v1.$_project.$scope';
  }

  Future<T> _exclusive<T>(Future<T> Function() action) async {
    if (_busy) throw StateError('Pending payment store busy');
    _busy = true;
    try {
      return await action();
    } finally {
      _busy = false;
    }
  }

  Future<PaymentCommand?> _read(OperatorAccount account) async {
    final raw = await _storage.read(_key(account));
    if (raw == null) return null;
    // A damaged record is NOT automatically deleted: collection may exist.
    if (raw.length > 128000) {
      throw const FormatException('Pending payment too large');
    }
    return PaymentCommand.restore(jsonDecode(raw), account: account);
  }

  Future<PaymentCommand?> load(OperatorAccount account) =>
      _exclusive(() => _read(account));

  /// Start a new collection only when no unresolved request exists.
  /// Unlike stage(), even an identical pending request is not a new payment.
  Future<void> stageNew(OperatorAccount account, PaymentCommand command) =>
      _exclusive(() async {
        command.assertAccount(account);
        if (await _read(account) != null) {
          throw StateError('Recover the existing payment first');
        }
        await _saveNew(account, command);
      });

  Future<void> _saveNew(
    OperatorAccount account,
    PaymentCommand command,
  ) async {
    final encoded = jsonEncode(command.toRecoveryJson());
    if (encoded.length > 128000) {
      throw const FormatException('Pending payment too large');
    }
    await _storage.write(_key(account), encoded);
    final saved = await _read(account);
    if (saved == null || jsonEncode(saved.toRecoveryJson()) != encoded) {
      throw StateError('Pending payment was not verified on disk');
    }
  }

  /// Must finish successfully before dispatch. If a write failed after
  /// committing locally, loading the same record remains the recovery path.
  Future<void> stage(OperatorAccount account, PaymentCommand command) =>
      _exclusive(() async {
        command.assertAccount(account);
        final existing = await _read(account);
        final encoded = jsonEncode(command.toRecoveryJson());
        if (encoded.length > 128000) {
          throw const FormatException('Pending payment too large');
        }
        if (existing != null) {
          if (jsonEncode(existing.toRecoveryJson()) != encoded) {
            throw StateError('Unresolved payment already exists');
          }
          return;
        }
        await _saveNew(account, command);
      });

  /// Call only with a fresh authenticated server response, not local data.
  /// The original receipt is validated before clearing the recovery record.
  Future<VerifiedPaymentReceipt> resolve(
    OperatorAccount account,
    Object? serverReceipt,
  ) => _exclusive(() async {
    final pending = await _read(account);
    if (pending == null) throw StateError('No pending payment');
    final receipt = VerifiedPaymentReceipt.decode(
      serverReceipt,
      command: pending,
    );
    // Persist the confirmed receipt before releasing the pending slot.
    // If a crash occurs between these writes, recover the same request again.
    final archiveKey =
        '${_key(account)}.receipt.${pending.payload['requestId']}';
    final archive = jsonEncode({
      'command': pending.toRecoveryJson(),
      'receipt': serverReceipt,
    });
    if (archive.length > 256000) {
      throw const FormatException('Receipt archive too large');
    }
    final existing = await _storage.read(archiveKey);
    if (existing != null) {
      final old = jsonDecode(existing);
      if (old is! Map ||
          jsonEncode(old['command']) != jsonEncode(pending.toRecoveryJson())) {
        throw StateError('Receipt archive conflict');
      }
      final oldReceipt = VerifiedPaymentReceipt.decode(
        old['receipt'],
        command: pending,
      );
      if (oldReceipt.paymentId != receipt.paymentId ||
          oldReceipt.receivedAt != receipt.receivedAt) {
        throw StateError('Receipt archive identity conflict');
      }
    }
    await _storage.write(archiveKey, archive);
    if (await _storage.read(archiveKey) != archive) {
      throw StateError('Receipt archive was not verified on disk');
    }
    await _storage.delete(_key(account));
    if (await _storage.read(_key(account)) != null) {
      throw StateError('Pending payment was not cleared');
    }
    return receipt;
  });
}
