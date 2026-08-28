package com.mwaldatk.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.os.RemoteException;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.SunmiPrinterService;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
    private volatile SunmiPrinterService printerService;
    private volatile boolean binding = false;

    private final InnerPrinterCallback printerCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            printerService = service;
            binding = false;
        }

        @Override
        protected void onDisconnected() {
            printerService = null;
            binding = false;
        }
    };

    @Override
    public void load() {
        super.load();
        bindPrinter();
    }

    private void bindPrinter() {
        if (binding || printerService != null) return;
        binding = true;
        try {
            boolean ok = InnerPrinterManager.getInstance().bindService(getContext(), printerCallback);
            if (!ok) binding = false;
        } catch (InnerPrinterException e) {
            binding = false;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        if (printerService == null) bindPrinter();
        JSObject ret = new JSObject();
        ret.put("available", printerService != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        JSObject receipt = call.getObject("receipt");
        if (receipt == null) {
            call.reject("Receipt data is missing");
            return;
        }

        if (printerService == null) {
            bindPrinter();
            // Give SUNMI's printer service a brief chance to bind, then print.
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (printerService == null) {
                    call.reject("SUNMI printer service is not ready");
                } else {
                    printReceiptNow(call, receipt);
                }
            }, 700);
            return;
        }

        printReceiptNow(call, receipt);
    }

    private String val(JSObject obj, String key, String fallback) {
        String v = obj.optString(key, fallback);
        return (v == null || v.trim().isEmpty()) ? fallback : v.trim();
    }

    // عرض الورق بالبكسل لطابعة حرارية 58مم بدقة 203dpi (القياس القياسي لأجهزة SUNMI V2).
    private static final int PAPER_WIDTH_PX = 384;
    private static final int PADDING = 10;
    private static final int CONTENT_WIDTH = PAPER_WIDTH_PX - (PADDING * 2);

    /**
     * طابعة SUNMI الحرارية تستخدم خط داخلي (built-in font) لا يدعم الحروف العربية إطلاقاً،
     * فاستدعاء printText() مباشرة بنص عربي يطبع سطراً فارغاً (الورق يتحرك بدون أي حرف مرئي).
     * الحل القياسي هو رسم الوصل بالكامل كصورة (Bitmap) باستخدام خط النظام (الذي يدعم العربية
     * بشكل كامل) ثم إرساله للطابعة عبر printBitmap بدلاً من printText.
     */
    private void printReceiptNow(PluginCall call, JSObject r) {
        new Thread(() -> {
            SunmiPrinterService service = printerService;
            if (service == null) {
                call.reject("SUNMI printer service disconnected");
                return;
            }

            try {
                Bitmap bitmap = buildReceiptBitmap(r);
                service.printerInit(null);
                service.setAlignment(1, null);
                service.printBitmap(bitmap, null);
                // سطر تغذية واحد فقط بعد نهاية الوصل لتقليل الفراغات.
                service.lineWrap(1, null);

                JSObject result = new JSObject();
                result.put("printed", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("SUNMI print failed: " + e.getMessage(), e);
            }
        }).start();
    }

    private Bitmap buildReceiptBitmap(JSObject r) {
        List<DrawLine> lines = new ArrayList<>();

        lines.add(new DrawLine(val(r, "header", "مولدتك"), 30f, true, Layout.Alignment.ALIGN_CENTER, 6));
        String location = val(r, "location", "");
        if (!location.isEmpty()) lines.add(new DrawLine(location, 20f, false, Layout.Alignment.ALIGN_CENTER, 4));
        lines.add(new DrawLine("وصل قبض", 20f, false, Layout.Alignment.ALIGN_CENTER, 2));
        lines.add(new DrawLine("رقم الوصل: " + val(r, "receiptNumber", "-"), 20f, false, Layout.Alignment.ALIGN_CENTER, 8));

        lines.add(separatorLine());

        addField(lines, "اسم المشترك", val(r, "subscriberName", "-"));
        addField(lines, "كود المشترك", val(r, "subscriberCode", "-"));

        String phone = val(r, "phone", "");
        if (!phone.isEmpty()) addField(lines, "رقم الهاتف", phone);

        String lineName = val(r, "lineName", "");
        if (!lineName.isEmpty()) addField(lines, "الكابينة / الفيز", lineName);

        addField(lines, "عدد الأمبيرات", val(r, "amperes", "-"));
        addField(lines, "سعر الأمبير", val(r, "pricePerAmp", "-"));
        addField(lines, "شهر التسديد", val(r, "month", "-"));
        addField(lines, "حالة الوصل", val(r, "status", "-"));

        String collector = val(r, "collector", "");
        if (!collector.isEmpty()) addField(lines, "اسم المحاسب", collector);

        lines.add(separatorLine());

        lines.add(new DrawLine("المبلغ الكلي", 24f, true, Layout.Alignment.ALIGN_CENTER, 2));
        lines.add(new DrawLine(val(r, "totalAmount", "0 د.ع"), 32f, true, Layout.Alignment.ALIGN_CENTER, 6));
        lines.add(new DrawLine("المبلغ المسدد: " + val(r, "paidAmount", "0 د.ع"), 22f, true, Layout.Alignment.ALIGN_CENTER, 2));
        lines.add(new DrawLine("المتبقي: " + val(r, "remainingAmount", "0 د.ع"), 22f, true, Layout.Alignment.ALIGN_CENTER, 8));

        lines.add(separatorLine());

        String note = val(r, "note", "");
        if (!note.isEmpty()) {
            lines.add(new DrawLine(note, 20f, true, Layout.Alignment.ALIGN_CENTER, 6));
        }

        lines.add(new DrawLine("تاريخ الإصدار: " + val(r, "issueDate", "-"), 18f, false, Layout.Alignment.ALIGN_CENTER, 2));
        lines.add(new DrawLine("وقت الطباعة: " + val(r, "printTime", "-"), 18f, false, Layout.Alignment.ALIGN_CENTER, 2));

        // تمرير أول لحساب الارتفاع الكلي للصورة.
        int totalHeight = PADDING * 2;
        List<StaticLayout> layouts = new ArrayList<>();
        for (DrawLine dl : lines) {
            StaticLayout sl = buildLayout(dl);
            layouts.add(sl);
            totalHeight += sl.getHeight() + dl.marginBottom;
        }

        Bitmap bitmap = Bitmap.createBitmap(PAPER_WIDTH_PX, Math.max(totalHeight, 1), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);

        float y = PADDING;
        for (int i = 0; i < lines.size(); i++) {
            DrawLine dl = lines.get(i);
            StaticLayout sl = layouts.get(i);
            canvas.save();
            canvas.translate(PADDING, y);
            sl.draw(canvas);
            canvas.restore();
            y += sl.getHeight() + dl.marginBottom;
        }

        return bitmap;
    }

    private void addField(List<DrawLine> lines, String label, String value) {
        lines.add(new DrawLine(label, 22f, true, Layout.Alignment.ALIGN_NORMAL, 0));
        lines.add(new DrawLine(value, 21f, false, Layout.Alignment.ALIGN_NORMAL, 6));
    }

    private DrawLine separatorLine() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 32; i++) sb.append('-');
        return new DrawLine(sb.toString(), 18f, false, Layout.Alignment.ALIGN_CENTER, 6);
    }

    private StaticLayout buildLayout(DrawLine dl) {
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        // Typeface.DEFAULT على أندرويد يدعم العربية عبر آلية fallback الخاصة بالنظام،
        // على عكس الخط المدمج داخل شريحة الطباعة الحرارية.
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, dl.bold ? Typeface.BOLD : Typeface.NORMAL));
        paint.setTextSize(dl.textSizePx);
        paint.setColor(Color.BLACK);

        StaticLayout.Builder builder = StaticLayout.Builder
                .obtain(dl.text, 0, dl.text.length(), paint, CONTENT_WIDTH)
                .setAlignment(dl.alignment)
                .setTextDirection(android.text.TextDirectionHeuristics.RTL)
                .setLineSpacing(0f, 1.0f)
                .setIncludePad(false);
        return builder.build();
    }

    private static final class DrawLine {
        final String text;
        final float textSizePx;
        final boolean bold;
        final Layout.Alignment alignment;
        final int marginBottom;

        DrawLine(String text, float textSizePx, boolean bold, Layout.Alignment alignment, int marginBottom) {
            this.text = text;
            this.textSizePx = textSizePx;
            this.bold = bold;
            this.alignment = alignment;
            this.marginBottom = marginBottom;
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            InnerPrinterManager.getInstance().unBindService(getContext(), printerCallback);
        } catch (Exception ignored) {}
        printerService = null;
        super.handleOnDestroy();
    }
}
