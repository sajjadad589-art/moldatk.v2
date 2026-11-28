import 'package:flutter/material.dart';

import '../../auth/domain/operator_account.dart';
import '../domain/subscriber_detail.dart';
import 'subscriber_profile_preview.dart';

class SubscriberDetailScreen extends StatefulWidget {
  const SubscriberDetailScreen({required this.load, this.account, super.key});

  final Future<SubscriberDetail> Function() load;
  final OperatorAccount? account;

  @override
  State<SubscriberDetailScreen> createState() => _SubscriberDetailScreenState();
}

class _SubscriberDetailScreenState extends State<SubscriberDetailScreen> {
  SubscriberDetail? _detail;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _detail = null;
      _failed = false;
    });
    try {
      final detail = await widget.load();
      if (mounted) setState(() => _detail = detail);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  String _status(String value) => switch (value) {
    'paid' => 'مسدد',
    'partial' => 'مسدد جزئياً',
    'unpaid' => 'غير مسدد',
    'free' => 'مجاني',
    'cancelled' => 'ملغى',
    _ => 'غير معروف',
  };

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    if (_failed) return const Text('تعذر قراءة تفاصيل المشترك.');
    if (detail == null) return const LinearProgressIndicator();
    final sub = detail.subscriber;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(sub.name, style: Theme.of(context).textTheme.headlineSmall),
        Text('الكود: ${sub.code}'),
        Text('الهاتف: ${sub.phone}'),
        Text('الكابينة: ${sub.lineName ?? 'بدون خط'}'),
        Text('الأمبيرات: ${sub.amperes}'),
        Text('حالة الاشتراك: ${_status(detail.paymentStatus)}'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text('المبلغ المستحق المسجل: ${detail.amountDue} د.ع'),
          ),
        ),
        const SizedBox(height: 12),
        const Text('الفواتير الأخيرة — قراءة فقط'),
        if (detail.invoices.isEmpty) const Text('لا توجد فواتير متاحة.'),
        for (final invoice in detail.invoices)
          Card(
            child: ListTile(
              title: Text('${invoice.month} — ${_status(invoice.status)}'),
              subtitle: Text(
                'المبلغ: ${invoice.total} د.ع\n'
                'المسدد: ${invoice.paid} د.ع',
              ),
              trailing: Text('${invoice.remaining} د.ع'),
            ),
          ),
        if (detail.hasMore) const Text('توجد فواتير أقدم غير معروضة.'),
        const Text('لا يمكن التسديد أو تعديل الفواتير من هذه المعاينة.'),
        if (widget.account != null &&
            detail.updatedAt != null &&
            detail.syncEpoch != null)
          SubscriberProfilePreview(
            key: ValueKey('${detail.subscriber.id}:${detail.updatedAt}:${detail.syncEpoch}'),
            account: widget.account!,
            detail: detail,
          ),
      ],
    );
  }
}
