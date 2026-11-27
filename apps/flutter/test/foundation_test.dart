import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/app/app.dart';
import 'package:moldatk_flutter/core/config/app_config.dart';

void main() {
  test('unknown environment fails closed', () {
    expect(() => AppConfig.parse('invalid'), throwsArgumentError);
    expect(AppConfig.parse('staging').environment, AppEnvironment.staging);
  });

  testWidgets('Arabic bootstrap is RTL and reports the configured environment', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appConfigProvider.overrideWithValue(
            const AppConfig(environment: AppEnvironment.staging),
          ),
        ],
        child: const MoldatkApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('مولدتك'), findsOneWidget);
    expect(find.text('البيئة: الاختبار'), findsOneWidget);
    final context = tester.element(find.text('تأسيس التطبيق'));
    expect(Directionality.of(context), TextDirection.rtl);
  });
}
