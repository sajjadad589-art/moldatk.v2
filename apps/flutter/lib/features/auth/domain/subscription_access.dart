enum SubscriptionAccess { active, expired, suspended, unavailable }

/// A short-lived online decision. Never persist or reuse it across restarts.
/// Supply elapsed monotonic time since the server request began.
class SubscriptionDecision {
  const SubscriptionDecision._(this.access, this.remaining);

  final SubscriptionAccess access;
  final Duration? remaining;

  static const maxAge = Duration(minutes: 1);

  static const unavailable = SubscriptionDecision._(
    SubscriptionAccess.unavailable,
    null,
  );

  static SubscriptionDecision evaluate({
    required Object? response,
    required String expectedGeneratorId,
    required Duration elapsed,
  }) {
    if (elapsed.isNegative || elapsed >= maxAge || response is! Map) {
      return unavailable;
    }
    final serverNow = _timestamp(response['serverNow']);
    final generator = response['generator'];
    if (response['ok'] != true ||
        response['accessActive'] is! bool ||
        serverNow == null ||
        generator is! Map ||
        expectedGeneratorId.trim().isEmpty ||
        generator['id'] != expectedGeneratorId) {
      return unavailable;
    }
    final status = generator['status'];
    if (status == 'suspended' && response['accessActive'] == false) {
      return const SubscriptionDecision._(
        SubscriptionAccess.suspended,
        null,
      );
    }
    if (status != 'active') return unavailable;

    final subscription = response['subscription'];
    if (response['accessActive'] == false) {
      return const SubscriptionDecision._(SubscriptionAccess.expired, null);
    }
    if (subscription is! Map || subscription['status'] != 'active') {
      return unavailable;
    }
    final startsAt = _timestamp(subscription['startsAt']);
    final endsAt = _timestamp(subscription['endsAt']);
    if (startsAt == null ||
        endsAt == null ||
        startsAt.isAfter(serverNow) ||
        !endsAt.isAfter(startsAt) ||
        !endsAt.isAfter(serverNow)) {
      return unavailable;
    }
    // Including the full round trip is conservative: network latency cannot
    // extend a grant. Device wall-clock adjustments are never consulted.
    final remaining = endsAt.difference(serverNow) - elapsed;
    if (remaining <= Duration.zero) {
      return const SubscriptionDecision._(SubscriptionAccess.expired, null);
    }
    return SubscriptionDecision._(SubscriptionAccess.active, remaining);
  }

  static DateTime? _timestamp(Object? value) {
    if (value is! String ||
        !RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(value)) {
      return null;
    }
    return DateTime.tryParse(value)?.toUtc();
  }
}
