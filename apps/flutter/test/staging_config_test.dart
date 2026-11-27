import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/core/config/app_config.dart';
import 'package:moldatk_flutter/features/auth/data/staging_config.dart';

void main() {
  const stagingRef = 'abcdefghijklmnopqrst';
  const productionRef = 'adluynhkikoodjljoxeu';

  StagingConfig config({
    AppEnvironment environment = AppEnvironment.staging,
    String ref = stagingRef,
    String? url,
    String key = 'sb_publishable_testfixture',
  }) => StagingConfig.validate(
    environment: environment,
    projectRef: ref,
    url: url ?? 'https://$ref.supabase.co',
    publishableKey: key,
  );

  test('accepts a dedicated HTTPS staging project', () {
    expect(config().url, 'https://$stagingRef.supabase.co');
  });

  test('rejects production and privileged or malformed configurations', () {
    expect(() => config(ref: productionRef), throwsFormatException);
    expect(
      () => config(environment: AppEnvironment.production),
      throwsFormatException,
    );
    expect(() => config(key: 'sb_secret_testfixture'), throwsFormatException);
    expect(
      () => config(url: 'http://$stagingRef.supabase.co'),
      throwsFormatException,
    );
    expect(() => config(url: 'https://example.com'), throwsFormatException);
  });
}
