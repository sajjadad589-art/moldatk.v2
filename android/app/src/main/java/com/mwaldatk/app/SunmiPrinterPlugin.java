package com.mwaldatk.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
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

    private String raw(JSObject obj, String key) {
        String v = obj.optString(key, "");
        return v == null ? "" : v.trim();
    }

    private static final int PAPER_WIDTH_PX = 384;
    private static final int PADDING = 10;
    private static final int CONTENT_WIDTH = PAPER_WIDTH_PX - (PADDING * 2);

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

        String generatorName = val(r, "header", "المولدة");
        lines.add(new DrawLine(generatorName, 31f, true, Layout.Alignment.ALIGN_CENTER, 10, true));
        lines.add(new DrawLine("إيصال تسديد", 24f, true, Layout.Alignment.ALIGN_CENTER, 8));

        String receiptNumber = raw(r, "receiptNumber");
        if (!receiptNumber.isEmpty()) addField(lines, "رقم الإيصال", receiptNumber, false);

        String issueDate = raw(r, "issueDate");
        if (!issueDate.isEmpty()) addField(lines, "التاريخ", issueDate, true);

        lines.add(separatorLine());

        String subscriberName = raw(r, "subscriberName");
        if (!subscriberName.isEmpty()) {
            lines.add(new DrawLine("اسم المشترك", 18f, true, Layout.Alignment.ALIGN_NORMAL, 1));
            lines.add(new DrawLine(subscriberName, 29f, true, Layout.Alignment.ALIGN_NORMAL, 7));
        }

        String phone = raw(r, "phone");
        if (!phone.isEmpty()) addField(lines, "رقم الهاتف", phone, false);

        String lineName = raw(r, "lineName");
        if (!lineName.isEmpty()) addField(lines, "الكابينة", lineName, false);

        String amperes = raw(r, "amperes");
        if (!amperes.isEmpty()) addField(lines, "عدد الأمبيرات", amperes, false);

        String pricePerAmp = raw(r, "pricePerAmp");
        if (!pricePerAmp.isEmpty()) addField(lines, "سعر الأمبير الشهري", pricePerAmp, true);

        String month = raw(r, "month");
        if (!month.isEmpty()) addField(lines, "شهر التسديد", month, true);

        String status = raw(r, "status");
        if (!status.isEmpty()) addField(lines, "حالة التسديد", status, false);

        lines.add(separatorLine());

        String paidAmount = raw(r, "paidAmount");
        String totalAmount = raw(r, "totalAmount");
        String finalAmount = !paidAmount.isEmpty() ? paidAmount : totalAmount;
        if (!finalAmount.isEmpty()) {
            lines.add(new DrawLine("مبلغ التسديد", 19f, true, Layout.Alignment.ALIGN_NORMAL, 1));
            lines.add(new DrawLine(finalAmount, 29f, true, Layout.Alignment.ALIGN_NORMAL, 7));
        }

        String remainingAmount = raw(r, "remainingAmount");
        if (!remainingAmount.isEmpty() && !remainingAmount.startsWith("0 ") && !remainingAmount.equals("0") && !remainingAmount.equals("0 د.ع")) {
            addField(lines, "المتبقي", remainingAmount, false);
        }

        lines.add(separatorLine());

        if (!finalAmount.isEmpty()) {
            lines.add(new DrawLine("المبلغ النهائي\n" + finalAmount, 31f, true, Layout.Alignment.ALIGN_CENTER, 10, true));
        }

        lines.add(new DrawLine("شكراً لتسديدكم", 19f, true, Layout.Alignment.ALIGN_CENTER, 8));
        lines.add(separatorLine());
        lines.add(new DrawLine("مولدتي", 31f, true, Layout.Alignment.ALIGN_CENTER, 2));
        lines.add(new DrawLine("نظام إدارة المولدات والجباية", 16f, true, Layout.Alignment.ALIGN_CENTER, 2));

        int totalHeight = PADDING * 2;
        List<StaticLayout> layouts = new ArrayList<>();
        for (DrawLine dl : lines) {
            StaticLayout sl = buildLayout(dl);
            layouts.add(sl);
            int boxExtra = dl.boxed ? 18 : 0;
            totalHeight += sl.getHeight() + dl.marginBottom + boxExtra;
        }

        Bitmap bitmap = Bitmap.createBitmap(PAPER_WIDTH_PX, Math.max(totalHeight, 1), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);

        float y = PADDING;
        for (int i = 0; i < lines.size(); i++) {
            DrawLine dl = lines.get(i);
            StaticLayout sl = layouts.get(i);

            if (dl.boxed) {
                Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
                border.setColor(Color.BLACK);
                border.setStyle(Paint.Style.STROKE);
                border.setStrokeWidth(3f);
                RectF rect = new RectF(PADDING, y, PAPER_WIDTH_PX - PADDING, y + sl.getHeight() + 16);
                canvas.drawRoundRect(rect, 11f, 11f, border);
                canvas.save();
                canvas.translate(PADDING, y + 8);
                sl.draw(canvas);
                canvas.restore();
                y += sl.getHeight() + 16 + dl.marginBottom;
            } else {
                canvas.save();
                canvas.translate(PADDING, y);
                sl.draw(canvas);
                canvas.restore();
                y += sl.getHeight() + dl.marginBottom;
            }
        }

        return bitmap;
    }

    private void addField(List<DrawLine> lines, String label, String value, boolean strong) {
        if (value == null || value.trim().isEmpty()) return;
        lines.add(new DrawLine(label + ":  " + value, strong ? 23f : 21f, strong, Layout.Alignment.ALIGN_NORMAL, 6));
    }

    private DrawLine separatorLine() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 32; i++) sb.append('-');
        return new DrawLine(sb.toString(), 17f, false, Layout.Alignment.ALIGN_CENTER, 6);
    }

    private StaticLayout buildLayout(DrawLine dl) {
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
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
        final boolean boxed;

        DrawLine(String text, float textSizePx, boolean bold, Layout.Alignment alignment, int marginBottom) {
            this(text, textSizePx, bold, alignment, marginBottom, false);
        }

        DrawLine(String text, float textSizePx, boolean bold, Layout.Alignment alignment, int marginBottom, boolean boxed) {
            this.text = text;
            this.textSizePx = textSizePx;
            this.bold = bold;
            this.alignment = alignment;
            this.marginBottom = marginBottom;
            this.boxed = boxed;
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
