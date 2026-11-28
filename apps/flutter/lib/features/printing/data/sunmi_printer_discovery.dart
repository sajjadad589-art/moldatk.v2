import 'package:flutter/services.dart';

enum SunmiDiagnosticResult { unavailable, busy, submitted, unknown }

/// Diagnostic only. Financial receipt submission remains disabled.
class SunmiPrinterDiscovery {
  const SunmiPrinterDiscovery();

  static const channel = MethodChannel('moldatk/sunmi');

  Future<SunmiDiagnosticResult> printDiagnostic() async {
    try {
      final response = await channel.invokeMethod<String>('printDiagnostic');
      return switch (response) {
        'unavailable' => SunmiDiagnosticResult.unavailable,
        'busy' => SunmiDiagnosticResult.busy,
        'submitted' => SunmiDiagnosticResult.submitted,
        _ => SunmiDiagnosticResult.unknown,
      };
    } on MissingPluginException {
      return SunmiDiagnosticResult.unavailable;
    } on PlatformException {
      return SunmiDiagnosticResult.unknown;
    }
  }

  Future<bool> isAvailable() async {
    try {
      return await channel.invokeMethod<bool>('isAvailable') == true;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
