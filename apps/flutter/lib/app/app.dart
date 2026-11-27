import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/app_config.dart';
import '../features/auth/data/staging_config.dart';
import '../features/auth/presentation/staging_session_screen.dart';
import '../features/bootstrap/presentation/bootstrap_screen.dart';

class MoldatkApp extends ConsumerWidget {
  const MoldatkApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'مولدتك',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF126A65)),
      ),
      home: _home(ref.watch(appConfigProvider).environment),
    );
  }

  Widget _home(AppEnvironment environment) {
    if (environment != AppEnvironment.staging) {
      return const BootstrapScreen();
    }
    try {
      final config = StagingConfig.fromBuild();
      return StagingSessionScreen(config: config);
    } on FormatException {
      return const BootstrapScreen();
    }
  }
}
