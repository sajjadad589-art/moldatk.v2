import 'package:flutter/material.dart';

import '../../auth/domain/operator_account.dart';
import '../../subscribers/domain/subscriber_detail.dart';
import '../domain/payment_command.dart';

class PaymentPreview extends StatefulWidget {
  const PaymentPreview({
    required this.account,
    required this.detail,
    super.key,
  });

  final OperatorAccount account;
  final SubscriberDetail detail;

  @override
  State<PaymentPreview> createState() => _PaymentPreviewState();
}

class _PaymentPreviewState extends State<PaymentPreview> {
  final _amount = TextEditingController();
  PaymentCommand? _preview;
  bool _invalid = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  void _calculate({bool full = false}) {
    try {
      final amount = full
          ? widget.detail.amountDue
          : int.parse(_amount.text.trim());
      final command = PaymentCommand.prepare(
        account: widget.account,
        detail: widget.detail,
        activeMonth: widget.detail.activeMonth!,
        hasActiveTariff: true,
        amount: amount,
      );
      if (full) _amount.text = amount.toString();
      setState(() {
        _preview = command;
        _invalid = false;
      });
    } catch (_) {
      setState(() {
        _preview = null;
        _invalid = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _preview?.plan;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('معاينة التسديد', style: Theme.of(context).textTheme.titleLarge),
            Text('الشهر الفعال: ${widget.detail.activeMonth}'),
            TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'المبلغ بالدينار'),
              onChanged: (_) => setState(() {
                _preview = null;
                _invalid = false;
              }),
            ),
            OutlinedButton(
              onPressed: _calculate,
              child: const Text('احتساب الدفعة'),
            ),
            OutlinedButton(
              onPressed: () => _calculate(full: true),
              child: const Text('معاينة التسديد الكامل'),
            ),
            if (_invalid)
              const Text('المبلغ أو بيانات الفواتير غير متطابقة.'),
            if (plan != null) ...[
              const Divider(),
              Text('المبلغ: ${plan.received} د.ع'),
              Text('الدين السابق: ${plan.previousDebtBefore} د.ع'),
              Text('المخصص للديون: ${plan.appliedToPrevious} د.ع'),
              Text('المخصص للشهر الحالي: ${plan.appliedToCurrent} د.ع'),
              for (final allocation in plan.allocations)
                Text('${allocation.month}: ${allocation.amount} د.ع'),
              Text('المتبقي بعد التسديد: ${plan.debtAfter} د.ع'),
              const Text('معاينة فقط — لم يتم قبض أو حفظ أي مبلغ.'),
            ],
          ],
        ),
      ),
    );
  }
}
