import 'package:flutter/material.dart';

import '../data/staging_auth_gateway.dart';
import '../domain/subscription_access.dart';

typedef VerifySignIn =
    Future<OperatorAccess> Function({
      required String identifier,
      required String secret,
    });

/// Internal staging-only account check. Does not grant a persistent session.
class StagingSignInScreen extends StatefulWidget {
  const StagingSignInScreen({required this.verify, super.key});

  final VerifySignIn verify;

  @override
  State<StagingSignInScreen> createState() => _StagingSignInScreenState();
}

class _StagingSignInScreenState extends State<StagingSignInScreen> {
  final _form = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _secret = TextEditingController();
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _identifier.dispose();
    _secret.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !(_form.currentState?.validate() ?? false)) return;
    final identifier = _identifier.text.trim();
    final secret = _secret.text;
    setState(() {
      _busy = true;
      _message = null;
      _secret.clear();
    });
    FocusScope.of(context).unfocus();
    String result;
    try {
      final access = await widget.verify(
        identifier: identifier,
        secret: secret,
      );
      result = switch (access.subscription.access) {
        SubscriptionAccess.active => 'نجح فحص الحساب والاشتراك.',
        SubscriptionAccess.expired => 'الاشتراك غير فعال.',
        SubscriptionAccess.suspended => 'الحساب موقوف.',
        SubscriptionAccess.unavailable => 'تعذر التحقق من الاشتراك.',
      };
    } catch (_) {
      result = 'تعذر التحقق من الدخول. تحقق من البيانات والاتصال.';
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      _message = result;
    });
  }

  String? _validate(String? value) {
    return value == null || value.trim().isEmpty ? 'الحقل مطلوب' : null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('مولدتك')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _form,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'تسجيل الدخول',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    const Text('بيئة الاختبار فقط — فحص مؤقت دون حفظ الجلسة.'),
                    const SizedBox(height: 24),
                    TextFormField(
                      key: const Key('identifier'),
                      controller: _identifier,
                      enabled: !_busy,
                      validator: _validate,
                      autocorrect: false,
                      decoration: const InputDecoration(
                        labelText: 'البريد الإلكتروني أو رقم الهاتف',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: const Key('secret'),
                      controller: _secret,
                      enabled: !_busy,
                      validator: _validate,
                      obscureText: true,
                      enableSuggestions: false,
                      autocorrect: false,
                      decoration: const InputDecoration(
                        labelText: 'كلمة المرور',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: Text(_busy ? 'جاري التحقق' : 'تحقق من الدخول'),
                    ),
                    if (_busy) const LinearProgressIndicator(),
                    if (_message != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: Text(_message!),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
