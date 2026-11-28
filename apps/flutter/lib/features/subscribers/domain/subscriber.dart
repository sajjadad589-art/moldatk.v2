class Subscriber {
  const Subscriber._({
    required this.id,
    required this.generatorId,
    required this.code,
    required this.name,
    required this.phone,
    required this.amperes,
    required this.lineName,
    required this.isExempted,
  });

  final String id;
  final String generatorId;
  final String code;
  final String name;
  final String phone;
  final int amperes;
  final String? lineName;
  final bool isExempted;

  factory Subscriber.fromRow(
    Map<String, dynamic> row, {
    required String expectedGeneratorId,
  }) {
    final tenant = _text(row, 'generator_id');
    if (tenant != expectedGeneratorId || expectedGeneratorId.isEmpty) {
      throw const FormatException('Subscriber tenant mismatch');
    }
    final amperes = row['amperes'];
    final exempted = row['is_exempted'];
    final line = row['line_name'];
    if (amperes is! int ||
        amperes < 0 ||
        exempted is! bool ||
        (line != null && line is! String)) {
      throw const FormatException('Invalid subscriber fields');
    }
    return Subscriber._(
      id: _text(row, 'id'),
      generatorId: tenant,
      code: _text(row, 'code', allowEmpty: true),
      name: _text(row, 'full_name', allowEmpty: true),
      phone: _text(row, 'phone', allowEmpty: true),
      amperes: amperes,
      lineName: line as String?,
      isExempted: exempted,
    );
  }

  static String _text(
    Map<String, dynamic> row,
    String key, {
    bool allowEmpty = false,
  }) {
    final value = row[key];
    if (value is! String || (!allowEmpty && value.trim().isEmpty)) {
      throw const FormatException('Invalid subscriber text');
    }
    return value;
  }
}

class SubscriberPage {
  SubscriberPage(List<Subscriber> items, {required this.nextCursor})
    : items = List.unmodifiable(items);

  final List<Subscriber> items;
  final String? nextCursor;
}
