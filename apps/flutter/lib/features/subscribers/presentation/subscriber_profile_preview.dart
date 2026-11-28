import 'package:flutter/material.dart';

import '../../auth/domain/operator_account.dart';
import '../domain/subscriber_detail.dart';
import '../domain/subscriber_profile_command.dart';

/// Preview only. Do not call the write endpoint from this widget.
class SubscriberProfilePreview extends StatefulWidget {
  const SubscriberProfilePreview({
    required this.account,
    required this.detail,
    super.key,
  });

  final OperatorAccount account;
  final SubscriberDetail detail;

  @override
  State<SubscriberProfilePreview> createState() => _SubscriberProfilePreviewState();
}

class _SubscriberProfilePreviewState extends State<SubscriberProfilePreview> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  SubscriberProfileCommand? _command;
  bool _invalid = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.detail.subscriber.name);
    _phone = TextEditingController(text: widget.detail.subscriber.phone);
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _changed(String _) {
    setState(() {
      _command = null;
      _invalid = false;
    });
  }

  void _preview() {
    try {
      final command = SubscriberProfileCommand.prepare(
        account: widget.account,
        detail: widget.detail,
        name: _name.text,
        phone: _phone.text,
      );
      setState(() {
        _command = command;
        _invalid = false;
      });
    } catch (_) {
      setState(() {
        _command = null;
        _invalid = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('تعديل الاسم والهاتف — معاينة فقط'),
        TextField(
          controller: _name,
          maxLength: 200,
          onChanged: _changed,
          decoration: const InputDecoration(labelText: 'اسم المشترك'),
        ),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          maxLength: 40,
          onChanged: _changed,
          decoration: const InputDecoration(labelText: 'الهاتف'),
        ),
        OutlinedButton(onPressed: _preview, child: const Text('معاينة التعديل')),
        if (_invalid) const Text('تحقق من البيانات أو عدم وجود تغيير.'),
        if (_command != null)
          const Text('تم تجهيز التعديل للمعاينة. لم يُحفظ في السيرفر.'),
      ],
    );
  }
}
