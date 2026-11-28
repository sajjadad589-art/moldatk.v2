import 'package:flutter/material.dart';

import '../data/sunmi_printer_discovery.dart';

class SunmiDiagnosticPanel extends StatefulWidget {
  const SunmiDiagnosticPanel({super.key});

  @override
  State<SunmiDiagnosticPanel> createState() => _SunmiDiagnosticPanelState();
}

class _SunmiDiagnosticPanelState extends State<SunmiDiagnosticPanel> {
  final _printer = const SunmiPrinterDiscovery();
  bool _busy = false;
  bool _available = false;
  String _message = 'افحص اتصال الطابعة المدمجة أولاً.';

  Future<void> _check() async {
    if (_busy) return;
    setState(() => _busy = true);
    final available = await _printer.isAvailable();
    if (!mounted) return;
    setState(() {
      _available = available;
      _busy = false;
      _message = available
          ? 'خدمة الطابعة متصلة.'
          : 'الطابعة غير متاحة أو لا تزال تتصل.';
    });
  }

  Future<void> _print() async {
    if (_busy || !_available) return;
    setState(() => _busy = true);
    final result = await _printer.printDiagnostic();
    if (!mounted) return;
    setState(() {
      _busy = false;
      // Require another explicit availability check for another test.
      _available = false;
      _message = switch (result) {
        SunmiDiagnosticResult.submitted =>
          'أُرسل الاختبار للطابعة. تحقق من الورقة فعلياً.',
        SunmiDiagnosticResult.unavailable => 'الطابعة غير متاحة.',
        SunmiDiagnosticResult.busy => 'الطابعة مشغولة.',
        SunmiDiagnosticResult.unknown =>
          'نتيجة الاختبار غير مؤكدة. تحقق من الورقة قبل المحاولة مجدداً.',
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('فحص طابعة SUNMI'),
            Text(_message),
            OutlinedButton(
              onPressed: _busy ? null : _check,
              child: const Text('فحص الاتصال'),
            ),
            FilledButton(
              onPressed: _busy || !_available ? null : _print,
              child: const Text('طباعة ورقة اختبار'),
            ),
            const Text('اختبار تقني فقط، لا يسجل دفعة أو إيصالاً مالياً.'),
          ],
        ),
      ),
    );
  }
}
