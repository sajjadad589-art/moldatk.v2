import 'package:flutter/material.dart';

import '../domain/subscriber.dart';

typedef LoadSubscriberPage = Future<SubscriberPage> Function(String? afterId);

/// Read-only staging component. No mutations, local cache or financial totals.
/// The parent must unmount it when the session is no longer authorized.
class SubscribersScreen extends StatefulWidget {
  const SubscribersScreen({required this.load, this.onOpen, super.key});

  final LoadSubscriberPage load;
  final ValueChanged<String>? onOpen;

  @override
  State<SubscribersScreen> createState() => _SubscribersScreenState();
}

class _SubscribersScreenState extends State<SubscribersScreen> {
  final _items = <Subscriber>[];
  String? _cursor;
  bool _busy = true;
  bool _failed = false;
  String _query = '';
  int _request = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(reset: true);
    });
  }

  Future<void> _load({bool reset = false}) async {
    final request = ++_request;
    setState(() {
      _busy = true;
      _failed = false;
      if (reset) {
        _items.clear();
        _cursor = null;
      }
    });
    try {
      final page = await widget.load(_cursor);
      if (!mounted || request != _request) return;
      final ids = _items.map((item) => item.id).toSet();
      if (page.items.any((item) => !ids.add(item.id))) {
        throw const FormatException('Duplicate subscriber across pages');
      }
      setState(() {
        _items.addAll(page.items);
        _cursor = page.nextCursor;
        _busy = false;
      });
    } catch (_) {
      if (!mounted || request != _request) return;
      setState(() {
        _items.clear();
        _cursor = null;
        _busy = false;
        _failed = true;
      });
    }
  }

  @override
  void dispose() {
    _request++;
    _items.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final visible = _items.where((item) {
      return query.isEmpty ||
          item.name.toLowerCase().contains(query) ||
          item.code.toLowerCase().contains(query) ||
          item.phone.contains(query);
    }).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('المشتركين', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        TextField(
          onChanged: (value) => setState(() => _query = value),
          decoration: const InputDecoration(
            labelText: 'بحث ضمن المشتركين المحملين',
            prefixIcon: Icon(Icons.search),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        Text('عدد السجلات المحملة: ${_items.length}'),
        OutlinedButton.icon(
          onPressed: _busy ? null : () => _load(reset: true),
          icon: const Icon(Icons.refresh),
          label: const Text('تحديث'),
        ),
        if (_busy) const LinearProgressIndicator(),
        if (_failed)
          const Text('تعذر تحميل المشتركين. أعد المحاولة.')
        else if (!_busy && visible.isEmpty)
          Text(
            _items.isEmpty
                ? 'لا توجد سجلات متاحة.'
                : 'لا توجد نتائج ضمن القائمة المحملة.',
          ),
        for (final item in visible)
          Card(
            child: ListTile(
              onTap: _busy || widget.onOpen == null ? null : () => widget.onOpen!(item.id),
              title: Text(item.name.isEmpty ? item.code : item.name),
              subtitle: Text(
                '${item.code} • ${item.lineName ?? 'بدون خط'}\n${item.phone}',
              ),
              trailing: Text('${item.amperes} A'),
              isThreeLine: true,
            ),
          ),
        if (_cursor != null && !_failed)
          FilledButton(
            onPressed: _busy ? null : () => _load(),
            child: const Text('تحميل المزيد'),
          ),
      ],
    );
  }
}
