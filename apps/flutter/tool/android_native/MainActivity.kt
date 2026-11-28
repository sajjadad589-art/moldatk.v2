package com.mwaldatk.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var bridge: FlutterSunmiBridge? = null
    private var channel: MethodChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        bridge = FlutterSunmiBridge(applicationContext)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "moldatk/sunmi")
        channel?.setMethodCallHandler(bridge)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        channel?.setMethodCallHandler(null)
        bridge?.close()
        bridge = null
        channel = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
