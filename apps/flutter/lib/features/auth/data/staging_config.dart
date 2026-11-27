import '../../../core/config/app_config.dart';

/// A separate staging project must be explicitly configured. Production is
/// deliberately blocked until release and tenant isolation tests are complete.
class StagingConfig {
  const StagingConfig._(this.url, this.publishableKey);

  final String url;
  final String publishableKey;

  factory StagingConfig.validate({
    required AppEnvironment environment,
    required String projectRef,
    required String url,
    required String publishableKey,
  }) {
    final uri = Uri.tryParse(url);
    if (environment != AppEnvironment.staging ||
        !RegExp(r'^[a-z0-9]{20}$').hasMatch(projectRef) ||
        projectRef == 'adluynhkikoodjljoxeu' ||
        uri == null ||
        uri.scheme != 'https' ||
        uri.host != '$projectRef.supabase.co' ||
        uri.userInfo.isNotEmpty ||
        uri.hasPort ||
        (uri.path.isNotEmpty && uri.path != '/') ||
        uri.hasQuery ||
        uri.hasFragment ||
        !RegExp(r'^sb_publishable_[A-Za-z0-9_-]+$').hasMatch(publishableKey)) {
      throw const FormatException('Invalid staging configuration');
    }
    return StagingConfig._('https://$projectRef.supabase.co', publishableKey);
  }

  factory StagingConfig.fromBuild() => StagingConfig.validate(
    environment: AppConfig.fromBuild().environment,
    projectRef: const String.fromEnvironment('STAGING_PROJECT_REF'),
    url: const String.fromEnvironment('SUPABASE_URL'),
    publishableKey: const String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY'),
  );
}
