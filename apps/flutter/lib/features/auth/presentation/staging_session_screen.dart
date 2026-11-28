import 'dart:async';

import 'package:flutter/material.dart';

import '../../subscribers/domain/subscriber_draft.dart';
import '../../subscribers/presentation/subscriber_detail_screen.dart';
import '../../subscribers/presentation/subscriber_draft_form.dart';
import '../../subscribers/presentation/subscribers_screen.dart';
import '../data/staging_config.dart';
import '../data/staging_session_gateway.dart';
import '../domain/operator_account.dart';
import '../domain/session_controller.dart';
import '../domain/subscription_access.dart';

/// Internal staging flow. Authorized read-only access; no offline access.
class StagingSessionScreen extends StatefulWidget {
  const StagingSessionScreen({required this.config, super.key});

  final StagingConfig config;

  @override
  State<StagingSessionScreen> createState() => _StagingSessionScreenState();
}

class _StagingSessionScreenState extends State<StagingSessionScreen>
    with WidgetsBindingObserver {
  late final SessionController _session;
  late final StagingSessionGateway _gateway;
  final _form = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  Timer? _refresh;
  bool _failed = false;
  bool _foreground = true;
  bool _showSubscribers = false;
  String? _selectedSubscriberId;
  bool _showDraft = false;
  int _draftRequest = 0;
  SubscriberDraftContext? _draftOptions;

  @override
  void initState() {
    super.initState();
    _gateway = StagingSessionGateway(widget.config);
    _session = SessionController(_gateway);
    _session.addListener(_changed);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _foreground) unawaited(_session.restore());
    });
    _refresh = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_foreground && _session.hasSession && !_session.busy) {
        if (_showDraft && _session.phase == SessionPhase.active) {
          unawaited(_refreshDraft());
        } else if (_session.phase != SessionPhase.denied) {
          unawaited(_session.revalidate());
        }
      }
    });
  }

  void _changed() {
    if (!mounted) return;
    setState(() {
      if (_session.phase != SessionPhase.active &&
          _session.phase != SessionPhase.checking) {
        _showSubscribers = false;
        _selectedSubscriberId = null;
        _clearDraft();
      }
    });
  }

  void _clearDraft() {
    _draftRequest++;
    _showDraft = false;
    _draftOptions = null;
  }

  Future<SubscriberDraftContext> _loadDraft() async {
    final request = ++_draftRequest;
    final options = await _session.readAuthorized(_gateway.readDraftOptions);
    if (!mounted ||
        !_foreground ||
        !_showDraft ||
        _session.phase != SessionPhase.active ||
        request != _draftRequest) {
      throw StateError('Draft closed');
    }
    setState(() => _draftOptions = options);
    return options;
  }

  Future<void> _refreshDraft() async {
    if (_session.busy || !_showDraft) return;
    try {
      await _loadDraft();
    } catch (_) {
      if (mounted && _showDraft && !_session.busy) {
        setState(_clearDraft);
      }
    }
  }

  void _openDraft() {
    setState(() {
      _showSubscribers = false;
      _showDraft = true;
      _draftOptions = null;
    });
    unawaited(_refreshDraft());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      setState(() {
        _foreground = false;
        _showSubscribers = false;
        _selectedSubscriberId = null;
        _clearDraft();
      });
      _password.clear();
      if (_session.busy) unawaited(_session.signOut());
    } else if (state == AppLifecycleState.resumed) {
      setState(() => _foreground = true);
      if (_session.hasSession) unawaited(_session.revalidate());
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
    if (!_foreground) return const SizedBox.shrink();
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
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${account.generatorName}\n$role',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            if (_showDraft) ...[
              OutlinedButton(
                onPressed: () => setState(_clearDraft),
                child: const Text('الرجوع'),
              ),
              if (_draftOptions == null)
                const LinearProgressIndicator()
              else
                SubscriberDraftForm(
                  key: ValueKey(_draftOptions!.snapshotKey),
                  options: _draftOptions!,
                  verify: _loadDraft,
                  enabled: !_session.busy,
                ),
            ] else if (_selectedSubscriberId != null &&
                account.role == OperatorRole.owner) ...[
              OutlinedButton(
                onPressed: () => setState(() => _selectedSubscriberId = null),
                child: const Text('الرجوع للمشتركين'),
              ),
              SubscriberDetailScreen(
                key: ValueKey('${account.userId}:${_selectedSubscriberId!}'),
                load: () {
                  final id = _selectedSubscriberId!;
                  return _session.readAuthorized(
                    (verified) => _gateway.readSubscriberDetail(verified, id),
                  );
                },
              ),
            ] else if (_showSubscribers) ...[
              OutlinedButton(
                onPressed: () => setState(() => _showSubscribers = false),
                child: const Text('الرجوع'),
              ),
              SubscribersScreen(
                key: ValueKey('${account.userId}:${account.generatorId}'),
                onOpen: account.role == OperatorRole.owner && !_session.busy
                    ? (id) => setState(() => _selectedSubscriberId = id)
                    : null,
                load: (afterId) => _session.readAuthorized(
                  (verified) => _gateway.readSubscribers(verified, afterId),
                ),
              ),
            ] else ...[
              FilledButton.icon(
                onPressed: _session.busy
                    ? null
                    : () => setState(() => _showSubscribers = true),
                icon: const Icon(Icons.people_outline),
                label: const Text('عرض المشتركين'),
              ),
              OutlinedButton.icon(
                onPressed: _session.busy ? null : _openDraft,
                icon: const Icon(Icons.person_add_outlined),
                label: const Text('إضافة مشترك — معاينة'),
              ),
            ],
            TextButton(
              onPressed: _session.signOut,
              child: const Text('تسجيل الخروج'),
            ),
          ],
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
