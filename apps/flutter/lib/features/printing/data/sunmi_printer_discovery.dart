import 'package:flutter/services.dart';

/// Native service discovery only. No receipt can be submitted from this API.
class SunmiPrinterDiscovery {
  const SunmiPrinterDiscovery();

  static const channel = MethodChannel('moldatk/sunmi');

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
