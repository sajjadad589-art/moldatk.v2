import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moldatk_flutter/features/printing/data/sunmi_printer_discovery.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  tearDown(() {
    messenger.setMockMethodCallHandler(SunmiPrinterDiscovery.channel, null);
  });

  test('native service availability is reported without printing', () async {
    messenger.setMockMethodCallHandler(SunmiPrinterDiscovery.channel, (
      call,
    ) async {
      expect(call.method, 'isAvailable');
      return true;
    });
    expect(await const SunmiPrinterDiscovery().isAvailable(), isTrue);
  });

  test('diagnostic submission is not proof of paper output', () async {
    messenger.setMockMethodCallHandler(SunmiPrinterDiscovery.channel, (
      call,
    ) async {
      expect(call.method, 'printDiagnostic');
      expect(call.arguments, isNull);
      return 'submitted';
    });
    expect(
      await const SunmiPrinterDiscovery().printDiagnostic(),
      SunmiDiagnosticResult.submitted,
    );
  });

  test('unknown diagnostic outcome is never retried automatically', () async {
    var calls = 0;
    messenger.setMockMethodCallHandler(SunmiPrinterDiscovery.channel, (
      _,
    ) async {
      calls++;
      throw PlatformException(code: 'connection_lost');
    });
    expect(
      await const SunmiPrinterDiscovery().printDiagnostic(),
      SunmiDiagnosticResult.unknown,
    );
    expect(calls, 1);
  });

  test('unavailable or unsupported device is not a print success', () async {
    messenger.setMockMethodCallHandler(
      SunmiPrinterDiscovery.channel,
      (_) async => false,
    );
    expect(await const SunmiPrinterDiscovery().isAvailable(), isFalse);
    messenger.setMockMethodCallHandler(SunmiPrinterDiscovery.channel, (
      _,
    ) async {
      throw PlatformException(code: 'unavailable');
    });
    expect(await const SunmiPrinterDiscovery().isAvailable(), isFalse);
  });
}
