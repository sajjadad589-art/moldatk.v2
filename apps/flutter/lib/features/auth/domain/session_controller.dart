import 'package:flutter/foundation.dart';

import 'operator_account.dart';
import 'subscription_access.dart';

abstract interface class SessionGateway {
  Future<OperatorAccount> signIn({
    required String identifier,
    required String secret,
  });

  Future<SubscriptionDecision> checkAccess(OperatorAccount account);

  Future<OperatorAccount?> restore();

  Future<void> close();

  Future<void> release();
}

enum SessionPhase { signedOut, checking, active, denied, unavailable }

/// A single-account session. No offline authorization.
class SessionController extends ChangeNotifier {
  SessionController(this._gateway);

  final SessionGateway _gateway;
  OperatorAccount? _account;
  SessionPhase _phase = SessionPhase.signedOut;
  SubscriptionAccess? _denial;
  bool _busy = false;
  bool _disposed = false;
  int _generation = 0;
  Stopwatch? _freshness;
  Duration? _validFor;

  SessionPhase get phase {
    if (_phase == SessionPhase.active &&
        (_freshness == null || _freshness!.elapsed >= _validFor!)) {
      return SessionPhase.unavailable;
    }
    return _phase;
  }

  OperatorAccount? get account =>
      phase == SessionPhase.active ? _account : null;

  SubscriptionAccess? get denial => _denial;

  bool get busy => _busy;

  bool get hasSession => _account != null;

  Future<void> signIn({
    required String identifier,
    required String secret,
  }) async {
    if (_busy || _disposed || _phase != SessionPhase.signedOut) return;
    _busy = true;
    final generation = ++_generation;
    _setPhase(SessionPhase.checking);
    try {
      final account = await _gateway.signIn(
        identifier: identifier,
        secret: secret,
      );
      if (!_current(generation)) return;
      _account = account;
      await _check(generation);
    } catch (_) {
      if (_current(generation)) {
        await _closeSafely();
      }
      if (_current(generation)) {
        _account = null;
        _setPhase(SessionPhase.signedOut);
      }
    } finally {
      if (!_current(generation)) await _closeSafely();
      _busy = false;
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> restore() async {
    if (_busy || _disposed || _phase != SessionPhase.signedOut) return;
    _busy = true;
    final generation = ++_generation;
    _setPhase(SessionPhase.checking);
    try {
      final account = await _gateway.restore();
      if (!_current(generation)) return;
      if (account == null) {
        _setPhase(SessionPhase.signedOut);
        return;
      }
      _account = account;
      await _check(generation);
    } catch (_) {
      await _closeSafely();
      if (_current(generation)) {
        _account = null;
        _setPhase(SessionPhase.signedOut);
      }
    } finally {
      if (!_current(generation)) await _closeSafely();
      _busy = false;
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> revalidate() async {
    if (_busy || _disposed || _account == null) return;
    _busy = true;
    final generation = _generation;
    _setPhase(SessionPhase.checking);
    try {
      await _check(generation);
    } catch (_) {
      if (_current(generation)) _setPhase(SessionPhase.unavailable);
    } finally {
      if (!_current(generation)) await _closeSafely();
      _busy = false;
      if (!_disposed) notifyListeners();
    }
  }

  /// Serialize read-only requests with authentication and subscription checks.
  /// A result is never returned after logout, disposal or denied access.
  Future<T> readAuthorized<T>(
    Future<T> Function(OperatorAccount account) read,
  ) async {
    final account = this.account;
    if (_busy || _disposed || account == null) {
      throw StateError('Session not available');
    }
    _busy = true;
    final generation = _generation;
    notifyListeners();
    try {
      await _check(generation);
      if (!_current(generation) || this.account == null) {
        throw StateError('Session not available');
      }
      final result = await read(account);
      if (!_current(generation)) {
        throw StateError('Session changed');
      }
      await _check(generation);
      if (!_current(generation) || this.account == null) {
        throw StateError('Session not available');
      }
      return result;
    } catch (_) {
      if (_current(generation) && _phase == SessionPhase.active) {
        _setPhase(SessionPhase.unavailable);
      }
      rethrow;
    } finally {
      if (!_current(generation)) await _closeSafely();
      _busy = false;
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> _check(int generation) async {
    final watch = Stopwatch()..start();
    final decision = await _gateway.checkAccess(_account!);
    if (!_current(generation)) return;
    _denial = decision.access;
    if (decision.access == SubscriptionAccess.active &&
        decision.remaining != null &&
        decision.remaining! > Duration.zero &&
        watch.elapsed < SubscriptionDecision.maxAge) {
      final freshnessBudget = SubscriptionDecision.maxAge - watch.elapsed;
      _validFor = decision.remaining! < freshnessBudget
          ? decision.remaining!
          : freshnessBudget;
      _freshness = Stopwatch()..start();
      _setPhase(SessionPhase.active);
    } else {
      _setPhase(
        decision.access == SubscriptionAccess.expired ||
                decision.access == SubscriptionAccess.suspended
            ? SessionPhase.denied
            : SessionPhase.unavailable,
      );
    }
  }

  /// Lock immediately; a later in-flight result cannot unlock this account.
  Future<void> signOut() async {
    if (_disposed) return;
    ++_generation;
    _account = null;
    _denial = null;
    _freshness = null;
    _validFor = null;
    _setPhase(SessionPhase.signedOut);
    if (!_busy) {
      _busy = true;
      try {
        await _closeSafely();
      } finally {
        _busy = false;
        if (!_disposed) notifyListeners();
      }
    }
  }

  bool _current(int generation) => !_disposed && generation == _generation;

  Future<void> _closeSafely() async {
    try {
      await _gateway.close();
    } catch (_) {
      // Local access is already denied. Never reveal a server error or token.
    }
  }

  Future<void> _releaseSafely() async {
    try {
      await _gateway.release();
    } catch (_) {
      // No local access after disposal.
    }
  }

  void _setPhase(SessionPhase value) {
    _phase = value;
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    _account = null;
    if (!_busy) _releaseSafely();
    super.dispose();
  }
}
