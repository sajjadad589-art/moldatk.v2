import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppEnvironment { development, staging, production }

class AppConfig {
  const AppConfig({required this.environment});

  final AppEnvironment environment;

  factory AppConfig.parse(String value) {
    return AppConfig(
      environment: switch (value) {
        'development' => AppEnvironment.development,
        'staging' => AppEnvironment.staging,
        'production' => AppEnvironment.production,
        _ => throw ArgumentError.value(value, 'APP_ENV', 'Unknown environment'),
      },
    );
  }

  static const _environment = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static AppConfig fromBuild() => AppConfig.parse(_environment);
}

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromBuild());
