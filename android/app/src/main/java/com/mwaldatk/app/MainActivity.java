package com.mwaldatk.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SunmiPrinterPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(BackNavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new Event('moldatk-android-back'));",
                    null
                )
            );
            return;
        }
        super.onBackPressed();
    }
}
