import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../printing/presentation/sunmi_diagnostic_panel.dart';

/// Internal engineering screen, not a completed sign-in or production UI.
class BootstrapScreen extends ConsumerWidget {
  const BootstrapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final environment = switch (config.environment) {
      AppEnvironment.development => 'التطوير',
      AppEnvironment.staging => 'الاختبار',
      AppEnvironment.production => 'الإنتاج',
    };
    return Scaffold(
      appBar: AppBar(title: const Text('مولدتك')),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.bolt, size: 56),
                  const SizedBox(height: 16),
                  Text(
                    'تأسيس التطبيق',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text('البيئة: $environment'),
                  const SizedBox(height: 12),
                  const Text(
                    'نسخة هندسية داخلية. تسجيل الدخول والبيانات غير متصلين بعد.',
                    textAlign: TextAlign.center,
                  ),
                  if (config.environment == AppEnvironment.development) ...[
                    const SizedBox(height: 24),
                    const SunmiDiagnosticPanel(),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
