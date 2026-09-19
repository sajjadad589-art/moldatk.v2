package com.mwaldatk.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.BitmapFactory;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.Looper;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.Base64;

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

    private boolean flag(JSObject obj, String key, boolean fallback) {
        return obj.has(key) ? obj.optBoolean(key, fallback) : fallback;
    }

    private static final int PAPER_WIDTH_PX = 384;
    private static final int PADDING = 16;
    private static final int CONTENT_WIDTH = PAPER_WIDTH_PX - (PADDING * 2);
    private static final int RECEIPT_LOGO_SIZE = 64;
    private static final int RECEIPT_LOGO_GAP = 8;
    private static final int RECEIPT_QR_SIZE = 168;
    private static final int RECEIPT_QR_GAP = 8;

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

        final boolean showLogo = flag(r, "showLogo", true);
        final boolean showSystemBrand = flag(r, "showSystemBrand", true);
        final boolean showGeneratorName = flag(r, "showGeneratorName", true);
        final boolean showSubTitle = flag(r, "showSubTitle", false);
        final boolean showDate = flag(r, "showDate", true);
        final boolean showReceiptNumber = flag(r, "showReceiptNumber", true);
        final boolean showSubscriberName = flag(r, "showSubscriberName", true);
        final boolean showPhone = flag(r, "showPhone", true);
        final boolean showOwnerPhone = flag(r, "showOwnerPhone", false);
        final boolean showLocationAddress = flag(r, "showLocationAddress", false);
        final boolean showLineName = flag(r, "showLineName", true);
        final boolean showAmperes = flag(r, "showAmperes", true);
        final boolean showPricePerAmp = flag(r, "showPricePerAmp", true);
        final boolean showPaymentMonth = flag(r, "showPaymentMonth", true);
        final boolean showPaymentStatus = flag(r, "showPaymentStatus", true);
        final boolean showCollectorName = flag(r, "showCollectorName", true);
        final boolean showPreviousDebt = flag(r, "showPreviousDebt", true);
        final boolean showCurrentCharge = flag(r, "showCurrentCharge", true);
        final boolean showTotalBeforePayment = flag(r, "showTotalBeforePayment", true);
        final boolean showAppliedToPreviousDebt = flag(r, "showAppliedToPreviousDebt", false);
        final boolean showAppliedToCurrentMonth = flag(r, "showAppliedToCurrentMonth", true);
        final boolean showRemainingAfterPayment = flag(r, "showRemainingAfterPayment", true);
        final boolean showReceivedAmount = flag(r, "showReceivedAmount", true);
        final boolean showThankYou = flag(r, "showThankYou", true);
        final boolean showQr = flag(r, "showQr", true);
        final boolean showFooterNotes = flag(r, "showFooterNotes", true);
        final boolean showFooterSystemText = flag(r, "showFooterSystemText", true);

        String systemTitle = val(r, "systemTitle", "مولدتك");
        String generatorName = val(r, "header", "المولدة");
        if (showSystemBrand && !systemTitle.isEmpty()) {
            lines.add(new DrawLine(systemTitle, 31f, true, Layout.Alignment.ALIGN_CENTER, 5));
        }
        if (showGeneratorName && !generatorName.isEmpty()) {
            lines.add(new DrawLine(generatorName, 24f, true, Layout.Alignment.ALIGN_CENTER, 8, true));
        }

        String subTitle = raw(r, "subTitle");
        if (showSubTitle && !subTitle.isEmpty()) {
            lines.add(new DrawLine(subTitle, 18f, true, Layout.Alignment.ALIGN_CENTER, 7));
        }

        String issueDate = raw(r, "issueDate");
        if (showDate && !issueDate.isEmpty()) addField(lines, val(r, "dateLabel", "التاريخ"), issueDate, true);

        String receiptNumber = raw(r, "receiptNumber");
        if (showReceiptNumber && !receiptNumber.isEmpty()) addField(lines, val(r, "receiptNumberLabel", "رقم الوصل"), receiptNumber, false);

        String ownerPhone = raw(r, "ownerPhone");
        if (showOwnerPhone && !ownerPhone.isEmpty()) addField(lines, val(r, "ownerPhoneLabel", "هاتف الإدارة"), ownerPhone, false);

        String location = raw(r, "location");
        if (showLocationAddress && !location.isEmpty()) addField(lines, val(r, "locationAddressLabel", "العنوان"), location, false);

        if (!lines.isEmpty()) lines.add(separatorLine());

        String subscriberName = raw(r, "subscriberName");
        if (showSubscriberName && !subscriberName.isEmpty()) {
            lines.add(new DrawLine(val(r, "subscriberNameLabel", "اسم المشترك"), 18f, true, Layout.Alignment.ALIGN_NORMAL, 1));
            lines.add(new DrawLine(subscriberName, 31f, true, Layout.Alignment.ALIGN_NORMAL, 9));
        }

        String phone = raw(r, "phone");
        if (showPhone && !phone.isEmpty()) addField(lines, val(r, "phoneLabel", "رقم الهاتف"), phone, false);

        String lineName = raw(r, "lineName");
        if (showLineName && !lineName.isEmpty()) addField(lines, val(r, "lineNameLabel", "الكابينة"), lineName, false);

        String amperes = raw(r, "amperes");
        if (showAmperes && !amperes.isEmpty()) addField(lines, val(r, "amperesLabel", "عدد الأمبيرات"), amperes, false);

        String pricePerAmp = raw(r, "pricePerAmp");
        if (showPricePerAmp && !pricePerAmp.isEmpty()) addField(lines, val(r, "pricePerAmpLabel", "سعر الأمبير الشهري"), pricePerAmp, true);

        String month = raw(r, "month");
        if (showPaymentMonth && !month.isEmpty()) addField(lines, val(r, "paymentMonthLabel", "شهر التسديد"), month, true);

        String status = raw(r, "status");
        if (showPaymentStatus && !status.isEmpty()) addField(lines, val(r, "paymentStatusLabel", "حالة التسديد"), status, false);

        String collector = raw(r, "collector");
        if (showCollectorName && !collector.isEmpty()) addField(lines, val(r, "collectorNameLabel", "المحاسب"), collector, false);

        lines.add(separatorLine());

        String previousDebt = raw(r, "previousDebt");
        if (showPreviousDebt && !previousDebt.isEmpty()) addField(lines, val(r, "previousDebtLabel", "الدين السابق"), previousDebt, true);

        String currentCharge = raw(r, "currentCharge");
        if (showCurrentCharge && !currentCharge.isEmpty()) addField(lines, val(r, "currentChargeLabel", "استحقاق الشهر الحالي"), currentCharge, true);

        String totalBeforePayment = raw(r, "totalBeforePayment");
        if (showTotalBeforePayment && !totalBeforePayment.isEmpty()) addField(lines, val(r, "totalBeforePaymentLabel", "الإجمالي قبل التسديد"), totalBeforePayment, true);

        lines.add(separatorLine());

        String appliedToPreviousDebt = raw(r, "appliedToPreviousDebt");
        if (showAppliedToPreviousDebt && !appliedToPreviousDebt.isEmpty()) {
            addField(lines, val(r, "appliedToPreviousDebtLabel", "تسديد الدين السابق"), appliedToPreviousDebt, false);
        }

        String appliedToCurrentMonth = raw(r, "appliedToCurrentMonth");
        if (showAppliedToCurrentMonth && !appliedToCurrentMonth.isEmpty()) {
            addField(lines, val(r, "appliedToCurrentMonthLabel", "تسديد الشهر الحالي"), appliedToCurrentMonth, false);
        }

        String remainingAmount = raw(r, "totalOutstandingAfter");
        if (remainingAmount.isEmpty()) remainingAmount = raw(r, "remainingAmount");
        if (showRemainingAfterPayment && !remainingAmount.isEmpty()) {
            addField(lines, val(r, "remainingAfterPaymentLabel", "المتبقي بعد التسديد"), remainingAmount, true);
        }

        String paidAmount = raw(r, "paidAmount");
        String totalAmount = raw(r, "totalAmount");
        String finalAmount = !paidAmount.isEmpty() ? paidAmount : totalAmount;
        if (showReceivedAmount && !finalAmount.isEmpty()) {
            lines.add(separatorLine());
            lines.add(new DrawLine(val(r, "receivedAmountLabel", "المبلغ المستلم") + "\n" + finalAmount, 25f, true, Layout.Alignment.ALIGN_CENTER, 8, true));
        }

        String thankYouText = val(r, "thankYouText", "شكراً لتسديدكم");
        if (showThankYou && !thankYouText.isEmpty()) {
            lines.add(new DrawLine(thankYouText, 19f, true, Layout.Alignment.ALIGN_CENTER, 8));
        }

        String note = raw(r, "note");
        if (showFooterNotes && !note.isEmpty()) {
            lines.add(new DrawLine(note, 17f, true, Layout.Alignment.ALIGN_CENTER, 8));
        }

        // MOLDATK_NATIVE_SUBSCRIBER_QR_V2
        Bitmap subscriberQr = showQr ? decodeQrDataUrl(raw(r, "qrDataUrl")) : null;
        StaticLayout qrTitle = null;
        if (subscriberQr != null) {
            qrTitle = buildLayout(new DrawLine(val(r, "qrCaption", "امسح الرمز لمتابعة حسابك"), 18f, true, Layout.Alignment.ALIGN_CENTER, 5));
        }

        StaticLayout footerLayout = null;
        String footerSystemText = raw(r, "footerSystemText");
        if (showFooterSystemText && !footerSystemText.isEmpty()) {
            footerLayout = buildLayout(new DrawLine(footerSystemText, 16f, true, Layout.Alignment.ALIGN_CENTER, 2));
        }

        int logoHeight = showLogo ? RECEIPT_LOGO_SIZE + RECEIPT_LOGO_GAP : 0;
        int qrExtraHeight = subscriberQr != null
                ? ((qrTitle != null ? qrTitle.getHeight() + 5 : 0) + RECEIPT_QR_SIZE + RECEIPT_QR_GAP)
                : 0;
        int footerExtraHeight = footerLayout != null ? footerLayout.getHeight() + 10 : 0;

        int totalHeight = PADDING * 2 + 18 + logoHeight + qrExtraHeight + footerExtraHeight;
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

        Paint outerBorder = new Paint(Paint.ANTI_ALIAS_FLAG);
        outerBorder.setColor(Color.BLACK);
        outerBorder.setStyle(Paint.Style.STROKE);
        outerBorder.setStrokeWidth(3f);
        RectF outerRect = new RectF(5f, 5f, PAPER_WIDTH_PX - 5f, totalHeight - 5f);
        canvas.drawRoundRect(outerRect, 12f, 12f, outerBorder);

        float y = PADDING + 18;
        if (showLogo) {
            try {
                Drawable logo = getContext().getDrawable(R.drawable.ic_moldatk_launcher);
                if (logo != null) {
                    int logoLeft = (PAPER_WIDTH_PX - RECEIPT_LOGO_SIZE) / 2;
                    logo.setBounds(logoLeft, (int) y, logoLeft + RECEIPT_LOGO_SIZE, (int) y + RECEIPT_LOGO_SIZE);
                    logo.draw(canvas);
                    y += RECEIPT_LOGO_SIZE + RECEIPT_LOGO_GAP;
                }
            } catch (Exception ignored) {}
        }

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

        if (subscriberQr != null) {
            if (qrTitle != null) {
                canvas.save();
                canvas.translate(PADDING, y);
                qrTitle.draw(canvas);
                canvas.restore();
                y += qrTitle.getHeight() + 4;
            }
            Bitmap scaledQr = Bitmap.createScaledBitmap(subscriberQr, RECEIPT_QR_SIZE, RECEIPT_QR_SIZE, false);
            float qrLeft = (PAPER_WIDTH_PX - RECEIPT_QR_SIZE) / 2f;
            canvas.drawBitmap(scaledQr, qrLeft, y, null);
            y += RECEIPT_QR_SIZE + RECEIPT_QR_GAP;
        }

        if (footerLayout != null) {
            canvas.save();
            canvas.translate(PADDING, y);
            footerLayout.draw(canvas);
            canvas.restore();
        }

        return bitmap;
    }

    private Bitmap decodeQrDataUrl(String dataUrl) {
        if (dataUrl == null || dataUrl.trim().isEmpty()) return null;
        try {
            String rawValue = dataUrl.trim();
            int comma = rawValue.indexOf(',');
            String encoded = comma >= 0 ? rawValue.substring(comma + 1) : rawValue;
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception ignored) {
            return null;
        }
    }
    private void addField(List<DrawLine> lines, String label, String value, boolean strong) {
        if (value == null || value.trim().isEmpty()) return;
        lines.add(new DrawLine(label + ":  " + value, strong ? 23f : 21f, true, Layout.Alignment.ALIGN_NORMAL, 6));
    }

    private DrawLine separatorLine() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 32; i++) sb.append('-');
        return new DrawLine(sb.toString(), 17f, true, Layout.Alignment.ALIGN_CENTER, 6);
    }

    private StaticLayout buildLayout(DrawLine dl) {
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        paint.setFakeBoldText(true);
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
            this.bold = true;
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
