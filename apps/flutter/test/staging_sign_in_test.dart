import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/auth/data/staging_auth_gateway.dart';
import 'package:moldatk_flutter/features/auth/domain/operator_account.dart';
import 'package:moldatk_flutter/features/auth/domain/subscription_access.dart';
import 'package:moldatk_flutter/features/auth/presentation/staging_sign_in_screen.dart';

void main() {
  testWidgets('empty form is rejected and a denied account remains denied', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: StagingSignInScreen(
          verify: ({required identifier, required secret}) async {
            calls++;
            expect(identifier, 'test@example.invalid');
            expect(secret, 'test-fixture');
            final account = OperatorAccount.fromJson({
              'userId': 'test-user',
              'generatorId': 'test-generator',
              'generatorName': 'Test',
              'role': 'generator_admin',
            });
            return OperatorAccess(account, SubscriptionDecision.unavailable);
          },
        ),
      ),
    );
    await tester.tap(find.text('تحقق من الدخول'));
    await tester.pump();
    expect(calls, 0);
    await tester.enterText(
      find.byKey(const Key('identifier')),
      'test@example.invalid',
    );
    await tester.enterText(find.byKey(const Key('secret')), 'test-fixture');
    await tester.tap(find.text('تحقق من الدخول'));
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.text('تعذر التحقق من الاشتراك.'), findsOneWidget);
    expect(find.text('نجح فحص الحساب والاشتراك.'), findsNothing);
    final field = tester.widget<TextFormField>(find.byKey(const Key('secret')));
    expect(field.controller?.text, isEmpty);
  });
}
