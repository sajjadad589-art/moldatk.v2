import 'dart:async';

import 'package:flutter/material.dart';

import '../data/staging_config.dart';
import '../data/staging_session_gateway.dart';
import '../domain/operator_account.dart';
import '../domain/session_controller.dart';
import '../domain/subscription_access.dart';

/// Internal staging flow. No business data or offline access is enabled.
class StagingSessionScreen extends StatefulWidget {
  const StagingSessionScreen({required this.config, super.key});

  final StagingConfig config;

  @override
  State<StagingSessionScreen> createState() => _StagingSessionScreenState();
}

class _StagingSessionScreenState extends State<StagingSessionScreen>
    with WidgetsBindingObserver {
  late final SessionController _session;
  final _form = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  Timer? _refresh;
  bool _failed = false;
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    _session = SessionController(StagingSessionGateway(widget.config));
    _session.addListener(_changed);
    WidgetsBinding.instance.addObserver(this);
    _refresh = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_foreground && _session.hasSession && !_session.busy) {
        if (_session.phase != SessionPhase.denied) {
          unawaited(_session.revalidate());
        }
      }
    });
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      _foreground = false;
      _password.clear();
      unawaited(_session.signOut());
    } else if (state == AppLifecycleState.resumed) {
      _foreground = true;
    }
  }

  Future<void> _submit() async {
    if (_session.busy || !(_form.currentState?.validate() ?? false)) return;
    final identifier = _identifier.text.trim();
    final secret = _password.text;
    setState(() => _failed = false);
    _password.clear();
    FocusScope.of(context).unfocus();
    await _session.signIn(identifier: identifier, secret: secret);
    if (!mounted || !_foreground) return;
    if (_session.phase == SessionPhase.signedOut) {
      setState(() => _failed = true);
    }
  }

  String? _required(String? value) {
    return value == null || value.trim().isEmpty ? 'الحقل مطلوب' : null;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refresh?.cancel();
    _session.removeListener(_changed);
    _session.dispose();
    _identifier.dispose();
    _password.dispose();
    super.dispose();
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
              child: _body(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body() {
    switch (_session.phase) {
      case SessionPhase.signedOut:
        return _loginForm();
      case SessionPhase.checking:
        return _status('جاري التحقق من الجلسة', loading: true);
      case SessionPhase.denied:
        final message = _session.denial == SubscriptionAccess.suspended
            ? 'الحساب موقوف'
            : 'الاشتراك غير فعال';
        return _status(message, retry: true);
      case SessionPhase.unavailable:
        return _status('تعذر التحقق من الاشتراك', retry: true);
      case SessionPhase.active:
        final account = _session.account;
        if (account == null) {
          return _status('تعذر التحقق من الاشتراك', retry: true);
        }
        final role = account.role == OperatorRole.owner
            ? 'صاحب المولدة'
            : 'جابي';
        return _status(
          'جلسة اختبار فعالة\n${account.generatorName}\n$role',
          retry: true,
        );
    }
  }

  Widget _status(String message, {bool loading = false, bool retry = false}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (loading) const LinearProgressIndicator(),
        const SizedBox(height: 16),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        if (retry)
          OutlinedButton(
            onPressed: _session.busy ? null : _session.revalidate,
            child: const Text('إعادة التحقق'),
          ),
        TextButton(
          onPressed: _session.signOut,
          child: const Text('تسجيل الخروج'),
        ),
      ],
    );
  }

  Widget _loginForm() {
    return Form(
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
          const Text('بيئة الاختبار فقط — لا توجد بيانات تشغيلية.'),
          const SizedBox(height: 24),
          TextFormField(
            controller: _identifier,
            validator: _required,
            enabled: !_session.busy,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'البريد الإلكتروني أو رقم الهاتف',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _password,
            validator: _required,
            enabled: !_session.busy,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            decoration: const InputDecoration(
              labelText: 'كلمة المرور',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _session.busy ? null : _submit,
            child: const Text('دخول'),
          ),
          if (_failed)
            const Text('تعذر تسجيل الدخول. تحقق من البيانات والاتصال.'),
        ],
      ),
    );
  }
}
