import 'package:flutter/material.dart';

import '../domain/onboarding_plan.dart';
import '../domain/subscriber_draft.dart';

/// Staging preview only. No save action or database writes.
class SubscriberDraftForm extends StatefulWidget {
  const SubscriberDraftForm({
    required this.options,
    required this.verify,
    required this.enabled,
    super.key,
  });

  final SubscriberDraftContext options;
  final Future<SubscriberDraftContext> Function() verify;
  final bool enabled;

  @override
  State<SubscriberDraftForm> createState() => _SubscriberDraftFormState();
}

class _SubscriberDraftFormState extends State<SubscriberDraftForm> {
  final _name = TextEditingController();
  final _code = TextEditingController();
  final _phone = TextEditingController();
  final _amperes = TextEditingController(text: '5');
  final _discount = TextEditingController(text: '0');
  String? _tierId;
  String? _lineId;
  String? _month;
  OnboardingDebtMode? _mode;
  SubscriberDraft? _draft;
  bool _invalid = false;
  bool _checking = false;

  bool get _free => widget.options.tiers.any(
    (tier) => tier.id == _tierId && tier.type == 'free',
  );

  @override
  void dispose() {
    for (final controller in [_name, _code, _phone, _amperes, _discount]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _change(VoidCallback apply) {
    setState(() {
      apply();
      _draft = null;
      _invalid = false;
    });
  }

  Future<void> _preview() async {
    if (_checking || !widget.enabled) return;
    final expected = widget.options.snapshotKey;
    setState(() {
      _checking = true;
      _draft = null;
      _invalid = false;
    });
    try {
      final latest = await widget.verify();
      if (!mounted) return;
      if (latest.snapshotKey != expected) {
        throw const FormatException('Options changed');
      }
      final draft = latest.preview(
        name: _name.text,
        code: _code.text,
        phone: _phone.text,
        tierId: _tierId ?? '',
        lineId: _lineId ?? '',
        amperes: int.parse(_amperes.text.trim()),
        discountAmperes: _free ? 0 : int.parse(_discount.text.trim()),
        mode: _free ? OnboardingDebtMode.free : _mode,
        priorMonth: _mode == OnboardingDebtMode.prior ? _month : null,
      );
      setState(() {
        _draft = draft;
        _invalid = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _draft = null;
          _invalid = true;
        });
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    TextInputType? keyboard,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboard,
      enabled: widget.enabled && !_checking,
      onChanged: (_) => _change(() {}),
      decoration: InputDecoration(labelText: label),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.options.canAdd || !widget.options.hasPricing) {
      return const Text('الإضافة غير متاحة: تحقق من الصلاحية والتسعيرة.');
    }
    final tiers = widget.options.tiers.where(
      (tier) => tier.type != 'free' || widget.options.canApplyFree,
    );
    final months =
        widget.options.history
            .where((item) => item.tierId == _tierId)
            .map((item) => item.tariff.monthId)
            .toSet()
            .toList()
          ..sort((a, b) => b.compareTo(a));
    return AbsorbPointer(
      absorbing: !widget.enabled || _checking,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('إضافة مشترك — معاينة فقط'),
          _field('اسم المشترك', _name),
          _field('كود المشترك', _code),
          _field('رقم الهاتف', _phone, keyboard: TextInputType.phone),
          DropdownButton<String>(
            isExpanded: true,
            value: _tierId,
            hint: const Text('فئة الاشتراك'),
            items: [
              for (final tier in tiers)
                DropdownMenuItem(value: tier.id, child: Text(tier.name)),
            ],
            onChanged: (value) => _change(() {
              _tierId = value;
              _mode = null;
              _month = null;
            }),
          ),
          DropdownButton<String>(
            isExpanded: true,
            value: _lineId,
            hint: const Text('الخط / الكابينة'),
            items: [
              for (final line in widget.options.lines)
                DropdownMenuItem(value: line.id, child: Text(line.name)),
            ],
            onChanged: (value) => _change(() => _lineId = value),
          ),
          _field('الأمبيرات', _amperes, keyboard: TextInputType.number),
          if (!_free) ...[
            _field('خصم الأمبيرات', _discount, keyboard: TextInputType.number),
            DropdownButton<OnboardingDebtMode>(
              isExpanded: true,
              value: _mode,
              hint: const Text('هل يوجد دين سابق؟'),
              items: const [
                DropdownMenuItem(
                  value: OnboardingDebtMode.none,
                  child: Text('بدون دين سابق'),
                ),
                DropdownMenuItem(
                  value: OnboardingDebtMode.prior,
                  child: Text('يوجد دين سابق'),
                ),
              ],
              onChanged: (value) => _change(() {
                _mode = value;
                _month = null;
              }),
            ),
            if (_mode == OnboardingDebtMode.prior)
              DropdownButton<String>(
                isExpanded: true,
                value: _month,
                hint: const Text('شهر الدين السابق'),
                items: [
                  for (final month in months)
                    DropdownMenuItem(value: month, child: Text(month)),
                ],
                onChanged: (value) => _change(() => _month = value),
              ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: widget.enabled && !_checking ? _preview : null,
            child: const Text('معاينة الاحتساب'),
          ),
          if (_checking || !widget.enabled) const LinearProgressIndicator(),
          if (_invalid) const Text('تحقق من البيانات والتسعيرة المختارة.'),
          if (_draft != null)
            Text('الدين المتوقع: ${_draft!.plan.amountDue} د.ع'),
          const Text('المعاينة لا تحفظ مشتركاً أو فاتورة.'),
        ],
      ),
    );
  }
}
