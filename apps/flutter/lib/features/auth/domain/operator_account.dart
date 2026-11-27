enum OperatorRole { owner, collector }

class OperatorAccount {
  const OperatorAccount._({
    required this.userId,
    required this.generatorId,
    required this.generatorName,
    required this.role,
  });

  final String userId;
  final String generatorId;
  final String generatorName;
  final OperatorRole role;

  factory OperatorAccount.fromJson(Object? value) {
    if (value is! Map) {
      throw const FormatException('Invalid account');
    }
    final role = switch (value['role']) {
      'generator_admin' => OperatorRole.owner,
      'collector' => OperatorRole.collector,
      _ => throw const FormatException('Unsupported operator role'),
    };
    return OperatorAccount._(
      userId: _requiredText(value['userId']),
      generatorId: _requiredText(value['generatorId']),
      generatorName: _requiredText(value['generatorName']),
      role: role,
    );
  }

  static String _requiredText(Object? value) {
    if (value is! String || value.trim().isEmpty) {
      throw const FormatException('Missing account field');
    }
    return value;
  }
}
